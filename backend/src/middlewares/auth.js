import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import ApiError from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asynHandler.js';

// Authentication middleware
export const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // Get token from different sources
  if (req.cookies.accessToken) {
    token = req.cookies.accessToken;
  } else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  // Check if token exists
  if (!token) {
    throw new ApiError(401, 'Access denied. No token provided.');
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    // Get user from database
    const user = await User.findById(decoded.userId).select(
      '-password -refreshTokens'
    );

    if (!user) {
      throw new ApiError(401, 'Token is valid but user not found');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new ApiError(403, 'Account has been deactivated');
    }

    // Check if account is locked
    if (user.isLocked) {
      throw new ApiError(423, 'Account is temporarily locked');
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token has expired');
    } else if (error instanceof ApiError) {
      throw error;
    } else {
      throw new ApiError(401, 'Authentication failed');
    }
  }
});

// Optional authentication (doesn't throw error if no token)
export const optionalAuth = asyncHandler(async (req, res, next) => {
  try {
    await authenticate(req, res, next);
  } catch (error) {
    // If authentication fails, continue without setting req.user
    next();
  }
});

// Authorization middleware (requires specific roles)
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Access denied. Required role: ${roles.join(' or ')}`
      );
    }

    next();
  };
};

// Check if user owns the resource or is admin
export const checkOwnershipOrAdmin = (resourceUserIdField = 'userId') => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    // Get resource user ID from different sources
    let resourceUserId;

    if (req.params.id) {
      resourceUserId = req.params.id;
    } else if (req.body[resourceUserIdField]) {
      resourceUserId = req.body[resourceUserIdField];
    } else if (req.params[resourceUserIdField]) {
      resourceUserId = req.params[resourceUserIdField];
    }

    // Check if user owns the resource
    if (
      resourceUserId &&
      resourceUserId.toString() !== req.user._id.toString()
    ) {
      throw new ApiError(
        403,
        'Access denied. You can only access your own resources.'
      );
    }

    next();
  });
};

// Verify email required middleware
export const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  if (!req.user.isEmailVerified) {
    throw new ApiError(
      403,
      'Email verification required. Please verify your email address.'
    );
  }

  next();
};

// Admin or owner check for user management
export const adminOrOwner = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const targetUserId = req.params.id || req.params.userId;

  // Admin can manage any user
  if (req.user.role === 'admin') {
    return next();
  }

  // User can only manage their own account
  if (targetUserId && targetUserId.toString() === req.user._id.toString()) {
    return next();
  }

  throw new ApiError(
    403,
    'Access denied. You can only manage your own account.'
  );
});

// Rate limiting by user
export const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const userRequests = requests.get(userId) || [];

    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      (timestamp) => now - timestamp < windowMs
    );

    if (validRequests.length >= maxRequests) {
      throw new ApiError(429, 'Too many requests. Please try again later.');
    }

    // Add current request
    validRequests.push(now);
    requests.set(userId, validRequests);

    next();
  };
};

// Check if user has specific permissions
export const hasPermission = (permission) => {
  const permissions = {
    'user.read': ['user', 'admin', 'moderator'],
    'user.write': ['admin', 'moderator'],
    'user.delete': ['admin'],
    'admin.read': ['admin'],
    'admin.write': ['admin'],
    'moderator.read': ['admin', 'moderator'],
    'moderator.write': ['admin'],
  };

  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const allowedRoles = permissions[permission];
    if (!allowedRoles || !allowedRoles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Access denied. Permission '${permission}' required.`
      );
    }

    next();
  };
};

// Middleware to add user context to logs
export const addUserContext = (req, res, next) => {
  if (req.user) {
    req.logContext = {
      userId: req.user._id,
      userEmail: req.user.email,
      userRole: req.user.role,
    };
  }
  next();
};
