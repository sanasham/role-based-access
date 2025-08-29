import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/user.js';
import ApiError from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asynHandler.js';
import { deleteFileIfExists } from '../utils/fileHelper.js';
import logger from '../utils/logger.js';
import {
  getPaginationData,
  getPaginationResponse,
} from '../utils/pagination.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get current user profile
export const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, { user }, 'User profile retrieved successfully')
    );
});

// Update user profile
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, phoneNumber } = req.body;
  const userId = req.user.id;

  const updateData = {};
  if (name?.trim()) updateData.name = name.trim();
  if (bio !== undefined) updateData['profile.bio'] = bio;
  if (phoneNumber !== undefined)
    updateData['profile.phoneNumber'] = phoneNumber;

  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  logger.info('User profile updated', {
    userId: user._id,
    updatedFields: Object.keys(updateData),
  });

  res
    .status(200)
    .json(new ApiResponse(200, { user }, 'Profile updated successfully'));
});

// Upload user avatar
export const uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'No file uploaded');
  }

  const userId = req.user.id;
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Delete old avatar if exists
  if (user.profile?.avatar) {
    const oldAvatarPath = path.join(__dirname, '..', user.profile.avatar);
    await deleteFileIfExists(oldAvatarPath);
  }

  // Update user with new avatar path
  const avatarPath = `uploads/avatars/${req.file.filename}`;
  user.profile = user.profile || {};
  user.profile.avatar = avatarPath;
  await user.save();

  logger.info('User avatar uploaded', {
    userId: user._id,
    filename: req.file.filename,
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user,
        avatarUrl: `/${avatarPath}`,
      },
      'Avatar uploaded successfully'
    )
  );
});

// Delete user avatar
export const deleteAvatar = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.profile?.avatar) {
    throw new ApiError(400, 'No avatar to delete');
  }

  // Delete avatar file
  const avatarPath = path.join(__dirname, '..', user.profile.avatar);
  await deleteFileIfExists(avatarPath);

  // Update user
  user.profile.avatar = undefined;
  await user.save();

  logger.info('User avatar deleted', { userId: user._id });

  res
    .status(200)
    .json(new ApiResponse(200, { user }, 'Avatar deleted successfully'));
});

// Get user by ID (Admin only)
export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res
    .status(200)
    .json(new ApiResponse(200, { user }, 'User retrieved successfully'));
});

// Get all users with pagination (Admin only)
export const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationData(req);
  const { search, role, isActive, isEmailVerified, sortBy, sortOrder } =
    req.query;

  // Build query
  const query = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  if (role && role !== 'all') {
    query.role = role;
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (isEmailVerified !== undefined) {
    query.isEmailVerified = isEmailVerified === 'true';
  }

  // Build sort options
  const sortOptions = {};
  if (sortBy) {
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
  } else {
    sortOptions.createdAt = -1; // Default sort by newest first
  }

  // Get users and total count
  const [users, totalCount] = await Promise.all([
    User.find(query).sort(sortOptions).skip(skip).limit(limit).lean(),
    User.countDocuments(query),
  ]);

  const response = getPaginationResponse(totalCount, page, limit, users);

  res
    .status(200)
    .json(new ApiResponse(200, response, 'Users retrieved successfully'));
});

// Update user role (Admin only)
export const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  // Prevent admin from changing their own role
  if (id === req.user.id) {
    throw new ApiError(400, 'You cannot change your own role');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const oldRole = user.role;
  user.role = role;
  await user.save();

  logger.info('User role updated', {
    userId: user._id,
    oldRole,
    newRole: role,
    updatedBy: req.user.id,
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user },
        `User role updated from ${oldRole} to ${role}`
      )
    );
});

// Deactivate user (Admin only)
export const deactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Prevent admin from deactivating themselves
  if (id === req.user.id) {
    throw new ApiError(400, 'You cannot deactivate your own account');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (!user.isActive) {
    throw new ApiError(400, 'User is already deactivated');
  }

  user.isActive = false;
  await user.save();

  // Remove all refresh tokens to force logout
  await user.removeAllRefreshTokens();

  logger.info('User deactivated', {
    userId: user._id,
    deactivatedBy: req.user.id,
  });

  res
    .status(200)
    .json(new ApiResponse(200, { user }, 'User deactivated successfully'));
});

// Reactivate user (Admin only)
export const reactivateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isActive) {
    throw new ApiError(400, 'User is already active');
  }

  user.isActive = true;
  await user.save();

  logger.info('User reactivated', {
    userId: user._id,
    reactivatedBy: req.user.id,
  });

  res
    .status(200)
    .json(new ApiResponse(200, { user }, 'User reactivated successfully'));
});

// Delete user permanently (Admin only)
export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Prevent admin from deleting themselves
  if (id === req.user.id) {
    throw new ApiError(400, 'You cannot delete your own account');
  }

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Delete user's avatar if exists
  if (user.profile?.avatar) {
    const avatarPath = path.join(__dirname, '..', user.profile.avatar);
    await deleteFileIfExists(avatarPath);
  }

  // Delete user
  await User.findByIdAndDelete(id);

  logger.info('User deleted permanently', {
    userId: user._id,
    email: user.email,
    deletedBy: req.user.id,
  });

  res.status(200).json(new ApiResponse(200, null, 'User deleted successfully'));
});

// Get user statistics (Admin only)
export const getUserStats = asyncHandler(async (req, res) => {
  const stats = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ isEmailVerified: true }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ role: 'moderator' }),
    User.countDocuments({ role: 'user' }),
    User.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),
    User.countDocuments({
      lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    }),
  ]);

  const [
    totalUsers,
    activeUsers,
    verifiedUsers,
    adminUsers,
    moderatorUsers,
    regularUsers,
    newUsersLast30Days,
    activeUsersLast30Days,
  ] = stats;

  const statistics = {
    totalUsers,
    activeUsers,
    inactiveUsers: totalUsers - activeUsers,
    verifiedUsers,
    unverifiedUsers: totalUsers - verifiedUsers,
    usersByRole: {
      admin: adminUsers,
      moderator: moderatorUsers,
      user: regularUsers,
    },
    newUsersLast30Days,
    activeUsersLast30Days,
    verificationRate:
      totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(2) : 0,
    activeRate:
      totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
  };

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { statistics },
        'User statistics retrieved successfully'
      )
    );
});

// Update user profile by admin
export const updateUserProfile = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, role, isActive, isEmailVerified } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent admin from modifying their own admin status
  if (id === req.user.id && (role !== user.role || isActive === false)) {
    throw new ApiError(400, 'You cannot modify your own role or active status');
  }

  // Update fields
  const updateData = {};
  if (name) updateData.name = name.trim();
  if (email && email !== user.email) {
    // Check if email already exists
    const emailExists = await User.findOne({
      email: email.toLowerCase(),
      _id: { $ne: id },
    });
    if (emailExists) {
      throw new ApiError(409, 'Email already exists');
    }
    updateData.email = email.toLowerCase();
    updateData.isEmailVerified = false; // Reset verification if email changes
  }
  if (role) updateData.role = role;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (isEmailVerified !== undefined)
    updateData.isEmailVerified = isEmailVerified;

  const updatedUser = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
  });

  logger.info('User profile updated by admin', {
    userId: updatedUser._id,
    updatedBy: req.user.id,
    updatedFields: Object.keys(updateData),
  });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: updatedUser },
        'User profile updated successfully'
      )
    );
});

// Search users (Admin only)
export const searchUsers = asyncHandler(async (req, res) => {
  const { q, role, limit = 10 } = req.query;

  if (!q || q.trim().length < 2) {
    throw new ApiError(400, 'Search query must be at least 2 characters long');
  }

  const query = {
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ],
  };

  if (role && role !== 'all') {
    query.role = role;
  }

  const users = await User.find(query)
    .limit(parseInt(limit))
    .select('name email role isActive isEmailVerified createdAt')
    .lean();

  res.status(200).json(
    new ApiResponse(
      200,
      {
        users,
        count: users.length,
        query: q,
      },
      'Search results retrieved successfully'
    )
  );
});

// Bulk operations (Admin only)
export const bulkUpdateUsers = asyncHandler(async (req, res) => {
  const { userIds, action, data } = req.body;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ApiError(400, 'User IDs array is required');
  }

  if (!action) {
    throw new ApiError(400, 'Action is required');
  }

  // Prevent admin from affecting their own account in bulk operations
  if (userIds.includes(req.user.id)) {
    throw new ApiError(
      400,
      'You cannot include your own account in bulk operations'
    );
  }

  let updateQuery = {};
  let resultMessage = '';

  switch (action) {
    case 'activate':
      updateQuery = { isActive: true };
      resultMessage = 'Users activated successfully';
      break;
    case 'deactivate':
      updateQuery = { isActive: false };
      resultMessage = 'Users deactivated successfully';
      break;
    case 'verify':
      updateQuery = { isEmailVerified: true };
      resultMessage = 'Users verified successfully';
      break;
    case 'updateRole':
      if (!data?.role) {
        throw new ApiError(400, 'Role is required for role update');
      }
      updateQuery = { role: data.role };
      resultMessage = `Users role updated to ${data.role}`;
      break;
    case 'delete':
      const deleteResult = await User.deleteMany({ _id: { $in: userIds } });
      logger.info('Bulk delete operation', {
        deletedCount: deleteResult.deletedCount,
        deletedBy: req.user.id,
      });
      return res.status(200).json(
        new ApiResponse(
          200,
          {
            modifiedCount: deleteResult.deletedCount,
          },
          'Users deleted successfully'
        )
      );
    default:
      throw new ApiError(400, 'Invalid action');
  }

  const result = await User.updateMany({ _id: { $in: userIds } }, updateQuery);

  // Remove refresh tokens for deactivated users
  if (action === 'deactivate') {
    const users = await User.find({ _id: { $in: userIds } });
    await Promise.all(users.map((user) => user.removeAllRefreshTokens()));
  }

  logger.info('Bulk update operation', {
    action,
    modifiedCount: result.modifiedCount,
    updatedBy: req.user.id,
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        modifiedCount: result.modifiedCount,
      },
      resultMessage
    )
  );
});
