// routes/test.js
import express from 'express';
import { sendTestEmail } from '../utils/emailService.js';

const emailRouter = express.Router();

emailRouter.get('/test-email', async (req, res) => {
  try {
    await sendTestEmail();
    res.json({ success: true, message: 'Test email sent successfully!' });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Test email failed',
      error: error.message,
    });
  }
});

export default emailRouter;
