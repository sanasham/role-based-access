import rateLimit from 'express-rate-limit';
import User from '../models/user.js';
import ApiError from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asynHandler.js';
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from '../utils/emailService.js';
import {
  generateRandomToken,
  generateTokens,
  hashToken,
} from '../utils/generateTokens.js';
import { getClientIP } from '../utils/helpers.js';
import logger from '../utils/logger.js';
import { clearTokenCookies, setTokenCookies } from '../utils/setCookies.js';

// Rate limiting configurations
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    error: 'Too many authentication attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts, please try again later' },
});

// Register user
export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ApiError(409, 'User with this email already exists');
  }

  try {
    // Create user
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || 'user',
    });

    // Generate email verification token
    const verificationToken = generateRandomToken();
    const hashedToken = hashToken(verificationToken);
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await user.save();

    // Send verification email
    try {
      await sendVerificationEmail(user, verificationToken);
      logger.info('Verification email sent', {
        userId: user._id,
        email: user.email,
      });
    } catch (emailError) {
      logger.error('Failed to send verification email', {
        userId: user._id,
        email: user.email,
        error: emailError.message,
      });
    }

    logger.info('User registered successfully', {
      userId: user._id,
      email: user.email,
    });

    res.status(201).json(
      new ApiResponse(
        201,
        {
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            createdAt: user.createdAt,
          },
        },
        'User registered successfully. Please check your email to verify your account.'
      )
    );
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'User with this email already exists');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      throw new ApiError(400, 'Validation failed', messages);
    }
    throw error;
  }
});

// Login user
export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and include necessary fields
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+password +loginAttempts +lockUntil'
  );

  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  // Check if account is locked
  if (user.isLocked) {
    throw new ApiError(
      423,
      'Account is temporarily locked due to too many failed login attempts. Please try again later.'
    );
  }

  // Check if account is active
  if (!user.isActive) {
    throw new ApiError(
      403,
      'Account has been deactivated. Please contact support.'
    );
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    await user.incLoginAttempts();
    logger.warn('Failed login attempt', {
      email: user.email,
      ipAddress: getClientIP(req),
      attempts: user.loginAttempts + 1,
    });
    throw new ApiError(401, 'Invalid email or password');
  }

  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user._id);

  // Add refresh token
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = getClientIP(req);
  await user.addRefreshToken(refreshToken, userAgent, ipAddress);

  // Set cookies
  setTokenCookies(res, accessToken, refreshToken);

  logger.info('User logged in successfully', {
    userId: user._id,
    email: user.email,
    ipAddress,
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
      'Login successful'
    )
  );
});

// Refresh token
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.cookies || req.body;

  if (!token) {
    throw new ApiError(401, 'Refresh token is required');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokens.some((t) => t.token === token)) {
      throw new ApiError(403, 'Invalid refresh token');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Account has been deactivated');
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user._id
    );

    // Replace old refresh token
    await user.removeRefreshToken(token);
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = getClientIP(req);
    await user.addRefreshToken(newRefreshToken, userAgent, ipAddress);

    // Set cookies
    setTokenCookies(res, accessToken, newRefreshToken);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          tokens: {
            accessToken,
            refreshToken: newRefreshToken,
          },
        },
        'Token refreshed successfully'
      )
    );
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      throw new ApiError(403, 'Invalid or expired refresh token');
    }
    throw error;
  }
});

// Logout user
export const logoutUser = asyncHandler(async (req, res) => {
  const { refreshToken } = req.cookies || req.body;
  const userId = req.user?.id;

  if (userId && refreshToken) {
    const user = await User.findById(userId);
    if (user) {
      await user.removeRefreshToken(refreshToken);
      logger.info('User logged out', { userId: user._id });
    }
  }

  clearTokenCookies(res);

  res.status(200).json(new ApiResponse(200, null, 'Logout successful'));
});

// Logout from all devices
export const logoutAllDevices = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await User.findById(userId);
  if (user) {
    await user.removeAllRefreshTokens();
    logger.info('User logged out from all devices', { userId: user._id });
  }

  clearTokenCookies(res);

  res
    .status(200)
    .json(
      new ApiResponse(200, null, 'Logged out from all devices successfully')
    );
});

// Change password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id;

  // Get user with password
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Verify current password
  const isCurrentPasswordValid = await user.comparePassword(currentPassword);
  if (!isCurrentPasswordValid) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Remove all refresh tokens
  await user.removeAllRefreshTokens();

  logger.info('Password changed successfully', { userId: user._id });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        'Password changed successfully. Please login again.'
      )
    );
});

// Forgot password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    // Don't reveal if email exists or not
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          null,
          'If an account with that email exists, we have sent a password reset link.'
        )
      );
    return;
  }

  // Generate password reset token
  const resetToken = generateRandomToken();
  const hashedToken = hashToken(resetToken);

  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await user.save();

  try {
    await sendPasswordResetEmail(user, resetToken);
    logger.info('Password reset email sent', {
      userId: user._id,
      email: user.email,
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    logger.error('Failed to send password reset email', {
      userId: user._id,
      email: user.email,
      error: error.message,
    });
    throw new ApiError(
      500,
      'Failed to send password reset email. Please try again.'
    );
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, null, 'Password reset email sent successfully.')
    );
});

// Reset password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const hashedToken = hashToken(token);

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, 'Invalid or expired password reset token');
  }

  // Update password
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // Remove all refresh tokens
  await user.removeAllRefreshTokens();

  logger.info('Password reset successfully', { userId: user._id });

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        null,
        'Password reset successful. Please login with your new password.'
      )
    );
});

// Verify email
export const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const hashedToken = hashToken(token);

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, 'Invalid or expired verification token');
  }

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();

  // Send welcome email
  try {
    await sendWelcomeEmail(user);
    logger.info('Welcome email sent', { userId: user._id, email: user.email });
  } catch (error) {
    logger.error('Failed to send welcome email', {
      userId: user._id,
      email: user.email,
      error: error.message,
    });
  }

  logger.info('Email verified successfully', {
    userId: user._id,
    email: user.email,
  });

  res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
        },
      },
      'Email verified successfully!'
    )
  );
});

// Resend verification email
export const resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  if (user.isEmailVerified) {
    throw new ApiError(400, 'Email is already verified');
  }

  // Generate new verification token
  const verificationToken = generateRandomToken();
  const hashedToken = hashToken(verificationToken);

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();

  try {
    await sendVerificationEmail(user, verificationToken);
    logger.info('Verification email resent', {
      userId: user._id,
      email: user.email,
    });
  } catch (error) {
    logger.error('Failed to resend verification email', {
      userId: user._id,
      email: user.email,
      error: error.message,
    });
    throw new ApiError(
      500,
      'Failed to send verification email. Please try again.'
    );
  }

  res
    .status(200)
    .json(new ApiResponse(200, null, 'Verification email sent successfully.'));
});
