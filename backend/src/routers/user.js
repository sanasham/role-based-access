import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  deactivateUser,
  deleteAvatar,
  deleteUser,
  getAllUsers,
  getCurrentUser,
  getUserById,
  reactivateUser,
  updateProfile,
  updateUserRole,
  uploadAvatar,
} from '../controllers/userController.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import {
  validateUpdateProfile,
  validateUserRole,
} from '../middlewares/validation.js';

const router = express.Router();

// Rate limiting for user operations
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    error: 'Too many user requests, please try again later',
  },
});

router.use(userLimiter);

// All user routes require authentication
router.use(authenticate);

// User profile routes
router.get('/profile', getCurrentUser);
router.put('/profile', validateUpdateProfile, updateProfile);
router.post('/avatar', upload.single('avatar'), uploadAvatar);
router.delete('/avatar', deleteAvatar);

// Admin only routes
router.use(authorize('admin')); // Apply admin authorization to all routes below

router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id/role', validateUserRole, updateUserRole);
router.put('/:id/deactivate', deactivateUser);
router.put('/:id/reactivate', reactivateUser);
router.delete('/:id', deleteUser);

export default router;
