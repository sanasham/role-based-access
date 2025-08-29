import express from 'express';
import {
  authLimiter,
  changePassword,
  forgotPassword,
  loginLimiter,
  loginUser,
  logoutAllDevices,
  logoutUser,
  refreshToken,
  registerUser,
  resendVerification,
  resetPassword,
  verifyEmail,
} from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';
import {
  validateChangePassword,
  validateForgotPassword,
  validateLogin,
  validateRegister,
  validateResetPassword,
} from '../middlewares/validation.js';

const router = express.Router();

// Apply rate limiting to all auth routes
router.use(authLimiter);

// Public routes
router.post('/register', validateRegister, registerUser);
router.post('/login', loginLimiter, validateLogin, loginUser);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', validateForgotPassword, forgotPassword);
router.post('/reset-password/:token', validateResetPassword, resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerification);

// Protected routes (require authentication)
router.use(authenticate); // Apply authentication middleware to all routes below

router.post('/logout', logoutUser);
router.post('/logout-all', logoutAllDevices);
router.put('/change-password', validateChangePassword, changePassword);

export default router;
