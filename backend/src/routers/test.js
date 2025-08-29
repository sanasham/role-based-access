import express from 'express';
import rateLimit from 'express-rate-limit';
import { checkDBConnection, dbHealthCheck } from '../config/database.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { sendTestEmail } from '../utils/emailService.js';

const router = express.Router();

// Rate limiting for test endpoints
const testLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many test requests, please try again later',
  },
});

router.use(testLimiter);

// Public health check
router.get('/health', async (req, res) => {
  console.log('helth check');
  try {
    const dbHealth = await dbHealthCheck();
    const memoryUsage = process.memoryUsage();

    res.status(200).json({
      success: true,
      message: 'System health check',
      data: {
        server: {
          status: 'healthy',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
          },
        },
        database: dbHealth,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message,
    });
  }
});

// Database connection test
router.get('/db-connection', (req, res) => {
  try {
    const connectionInfo = checkDBConnection();

    res.status(200).json({
      success: true,
      message: 'Database connection status',
      data: connectionInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database connection check failed',
      error: error.message,
    });
  }
});

// Protected test routes
router.use(authenticate);

// Email test (requires authentication)
router.post('/email', async (req, res) => {
  try {
    const { to, subject, message } = req.body;

    // Use provided email or default to user's email
    const recipient = to || req.user.email;

    const result = await sendTestEmail(recipient, subject, message);

    res.status(200).json({
      success: true,
      message: 'Test email sent successfully',
      data: {
        recipient,
        messageId: result.messageId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message,
    });
  }
});

// Admin only test routes
router.use(authorize('admin'));

// System information (admin only)
router.get('/system-info', (req, res) => {
  try {
    const systemInfo = {
      platform: process.platform,
      architecture: process.arch,
      nodeVersion: process.version,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      message: 'System information',
      data: systemInfo,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get system information',
      error: error.message,
    });
  }
});

// Environment variables test (admin only - be careful with sensitive data)
router.get('/env-check', (req, res) => {
  try {
    const envCheck = {
      nodeEnv: !!process.env.NODE_ENV,
      port: !!process.env.PORT,
      mongodbUri: !!process.env.MONGODB_URI,
      jwtAccessSecret: !!process.env.JWT_ACCESS_SECRET,
      jwtRefreshSecret: !!process.env.JWT_REFRESH_SECRET,
      emailUser: !!process.env.EMAIL_USER,
      emailAppPassword: !!process.env.EMAIL_APP_PASSWORD,
      clientUrl: !!process.env.CLIENT_URL,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json({
      success: true,
      message: 'Environment variables check',
      data: envCheck,
      note: 'Only checking if variables exist, not their values',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Environment check failed',
      error: error.message,
    });
  }
});

export default router;
