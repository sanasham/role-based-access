import validator from 'validator';
import ApiError from '../utils/ApiError.js';

// Helper function to validate password strength
const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return {
      isValid: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  if (!hasUppercase || !hasLowercase || !hasNumbers || !hasSpecialChar) {
    return {
      isValid: false,
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    };
  }

  return { isValid: true };
};

// Register validation
export const validateRegister = (req, res, next) => {
  console.log('req.body:', req.body);
  const { name, email, password, role } = req.body;
  const errors = [];

  // Name validation
  if (!name || !name.trim()) {
    errors.push('Name is required');
  } else if (name.trim().length < 2) {
    errors.push('Name must be at least 2 characters long');
  } else if (name.trim().length > 50) {
    errors.push('Name cannot exceed 50 characters');
  } else if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
    errors.push('Name can only contain letters and spaces');
  }

  // Email validation
  if (!email || !email.trim()) {
    errors.push('Email is required');
  } else if (!validator.isEmail(email)) {
    errors.push('Please provide a valid email address');
  }

  // Password validation
  if (!password) {
    errors.push('Password is required');
  } else {
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
      errors.push(passwordCheck.message);
    }
  }

  // Role validation (optional)
  if (role && !['user', 'admin', 'moderator'].includes(role)) {
    errors.push('Invalid role specified');
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  next();
};

// Login validation
export const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  console.log('=====================================');
  console.log(email, password);
  const errors = [];

  if (!email || !email.trim()) {
    errors.push('Email is required');
  } else if (!validator.isEmail(email)) {
    errors.push('Please provide a valid email address');
  }

  if (!password) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  next();
};

// Forgot password validation
export const validateForgotPassword = (req, res, next) => {
  const { email } = req.body;
  const errors = [];

  if (!email || !email.trim()) {
    errors.push('Email is required');
  } else if (!validator.isEmail(email)) {
    errors.push('Please provide a valid email address');
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  next();
};

// Reset password validation
export const validateResetPassword = (req, res, next) => {
  const { password, confirmPassword } = req.body;
  const { token } = req.params;
  const errors = [];

  if (!token) {
    errors.push('Reset token is required');
  }

  if (!password) {
    errors.push('Password is required');
  } else {
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.isValid) {
      errors.push(passwordCheck.message);
    }
  }

  if (!confirmPassword) {
    errors.push('Password confirmation is required');
  } else if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  next();
};

// Change password validation
export const validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = [];

  if (!currentPassword) {
    errors.push('Current password is required');
  }

  if (!newPassword) {
    errors.push('New password is required');
  } else {
    const passwordCheck = validatePasswordStrength(newPassword);
    if (!passwordCheck.isValid) {
      errors.push(passwordCheck.message);
    }
  }

  if (!confirmPassword) {
    errors.push('Password confirmation is required');
  } else if (newPassword !== confirmPassword) {
    errors.push('New passwords do not match');
  }

  if (currentPassword && newPassword && currentPassword === newPassword) {
    errors.push('New password must be different from current password');
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  next();
};

// Update profile validation
export const validateUpdateProfile = (req, res, next) => {
  const { name, bio, phoneNumber } = req.body;
  const errors = [];

  // Name validation (optional for update)
  if (name !== undefined) {
    if (!name.trim()) {
      errors.push('Name cannot be empty');
    } else if (name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    } else if (name.trim().length > 50) {
      errors.push('Name cannot exceed 50 characters');
    } else if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
      errors.push('Name can only contain letters and spaces');
    }
  }

  // Bio validation (optional)
  if (bio !== undefined && bio.length > 500) {
    errors.push('Bio cannot exceed 500 characters');
  }

  // Phone number validation (optional)
  if (phoneNumber !== undefined && phoneNumber.trim()) {
    if (!validator.isMobilePhone(phoneNumber)) {
      errors.push('Please provide a valid phone number');
    }
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  next();
};

// User role validation (admin only)
export const validateUserRole = (req, res, next) => {
  const { role } = req.body;
  const errors = [];

  if (!role) {
    errors.push('Role is required');
  } else if (!['user', 'admin', 'moderator'].includes(role)) {
    errors.push('Invalid role specified. Must be: user, admin, or moderator');
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  next();
};

// Email validation helper
export const validateEmail = (req, res, next) => {
  const { email } = req.body;
  const errors = [];

  if (!email || !email.trim()) {
    errors.push('Email is required');
  } else if (!validator.isEmail(email)) {
    errors.push('Please provide a valid email address');
  }

  if (errors.length > 0) {
    throw new ApiError(400, 'Validation failed', errors);
  }

  next();
};

// MongoDB ObjectId validation
export const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!id) {
      throw new ApiError(400, `${paramName} parameter is required`);
    }

    if (!validator.isMongoId(id)) {
      throw new ApiError(400, `Invalid ${paramName} format`);
    }

    next();
  };
};

// Pagination validation
export const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page && !validator.isInt(page.toString(), { min: 1 })) {
    throw new ApiError(400, 'Page must be a positive integer');
  }

  if (limit && !validator.isInt(limit.toString(), { min: 1, max: 100 })) {
    throw new ApiError(
      400,
      'Limit must be a positive integer between 1 and 100'
    );
  }

  next();
};

// File upload validation
export const validateFileUpload = (
  allowedTypes = [],
  maxSize = 5 * 1024 * 1024
) => {
  return (req, res, next) => {
    if (!req.file) {
      throw new ApiError(400, 'File is required');
    }

    // Check file size
    if (req.file.size > maxSize) {
      throw new ApiError(
        400,
        `File size cannot exceed ${Math.round(maxSize / (1024 * 1024))}MB`
      );
    }

    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(req.file.mimetype)) {
      throw new ApiError(
        400,
        `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`
      );
    }

    next();
  };
};

// Sanitize input (remove XSS attempts)
export const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          // Basic XSS prevention
          obj[key] = obj[key].replace(
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            ''
          );
          obj[key] = validator.escape(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

// Custom validation middleware factory
export const customValidation = (validationRules) => {
  return (req, res, next) => {
    const errors = [];

    for (const rule of validationRules) {
      const { field, value, validator: validatorFn, message } = rule;
      const fieldValue =
        value || req.body[field] || req.query[field] || req.params[field];

      if (!validatorFn(fieldValue)) {
        errors.push(message || `Validation failed for field: ${field}`);
      }
    }

    if (errors.length > 0) {
      throw new ApiError(400, 'Validation failed', errors);
    }

    next();
  };
};
