import crypto from 'crypto';
import User from '../models/user.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asynHandler.js';
import { sendEmail } from '../utils/emailService.js';
import { generateTokens } from '../utils/generateToken.js';
import validatePassword from '../utils/validatePasswordStrength.js';

export const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  // Validate required fields
  if (!name?.trim() || !email?.trim() || !password) {
    throw new ApiError(400, 'Name, email, and password are required');
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw new ApiError(400, passwordValidation.message);
  }

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new ApiError(409, 'User with this email already exists');
  }

  // Validate role if provided
  if (role && !['user', 'admin', 'moderator'].includes(role)) {
    throw new ApiError(400, 'Invalid role specified');
  }

  try {
    // Create user (password will be hashed by pre-save middleware)
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role || 'user',
    });

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = crypto
      .createHash('sha256')
      .update(emailVerificationToken)
      .digest('hex');
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await user.save();

    // Send verification email (implement based on your email service)
    try {
      await sendEmail({
        to: user.email,
        subject: 'Verify Your Email Address',
        template: 'emailVerification',
        data: {
          name: user.name,
          verificationUrl: `${process.env.CLIENT_URL}/verify-email/${emailVerificationToken}`,
        },
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Add refresh token to user
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = req.ip || req.connection.remoteAddress;
    await user.addRefreshToken(refreshToken, userAgent, ipAddress);

    // Set secure cookies
    setTokenCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      message:
        'User registered successfully. Please check your email to verify your account.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          createdAt: user.createdAt,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'User with this email already exists');
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      throw new ApiError(400, messages.join(', '));
    }
    throw error;
  }
});

export const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email?.trim() || !password) {
    throw new ApiError(400, 'Email and password are required');
  }

  // Find user and include password field
  const user = await User.findByEmail(email).select(
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

  // Compare password
  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    // Increment login attempts
    await user.incLoginAttempts();
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

  // Add refresh token to user
  const userAgent = req.get('User-Agent') || '';
  const ipAddress = req.ip || req.connection.remoteAddress;
  await user.addRefreshToken(refreshToken, userAgent, ipAddress);

  // Set secure cookies
  setTokenCookies(res, accessToken, refreshToken);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
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
  });
});
