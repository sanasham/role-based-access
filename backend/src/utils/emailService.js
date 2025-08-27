import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gmail transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use TLS
    auth: {
      user: process.env.EMAIL_USER || 'sayyed.devwork@gmail.com',
      pass: process.env.EMAIL_APP_PASSWORD, // App Password (not regular password)
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

// Email templates
const emailTemplates = {
  emailVerification: {
    subject: 'Verify Your Email Address',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Our Platform!</h1>
          </div>
          <div class="content">
            <h2>Hi {{name}},</h2>
            <p>Thank you for registering with us! We're excited to have you on board.</p>
            <p>To complete your registration and start using your account, please verify your email address by clicking the button below:</p>
            <div style="text-align: center;">
              <a href="{{verificationUrl}}" class="button">Verify Email Address</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;"><a href="{{verificationUrl}}">{{verificationUrl}}</a></p>
            <div class="warning">
              <strong>⚠️ Important:</strong> This verification link will expire in 24 hours for security reasons.
            </div>
            <p>If you didn't create an account with us, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>© 2025 Your App Name. All rights reserved.</p>
            <p>If you have any questions, contact us at sayyed.devwork@gmail.com</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  passwordReset: {
    subject: 'Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .warning { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi {{name}},</h2>
            <p>We received a request to reset the password for your account.</p>
            <p>If you made this request, click the button below to reset your password:</p>
            <div style="text-align: center;">
              <a href="{{resetUrl}}" class="button">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;"><a href="{{resetUrl}}">{{resetUrl}}</a></p>
            <div class="warning">
              <strong>⚠️ Important:</strong> This password reset link will expire in 1 hour for security reasons.
            </div>
            <p><strong>If you didn't request this password reset, please ignore this email or contact our support team immediately.</strong></p>
          </div>
          <div class="footer">
            <p>© 2025 Your App Name. All rights reserved.</p>
            <p>If you have any questions, contact us at sayyed.devwork@gmail.com</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },

  welcomeEmail: {
    subject: 'Welcome to Our Platform! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome!</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .button { display: inline-block; background: linear-gradient(135deg, #2ecc71 0%, #27ae60 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
          .feature { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to Our Platform!</h1>
          </div>
          <div class="content">
            <h2>Hi {{name}},</h2>
            <p>Congratulations! Your email has been successfully verified and your account is now active.</p>
            <p>Here's what you can do next:</p>
            <div class="feature">
              <h3>✨ Complete Your Profile</h3>
              <p>Add more information to your profile to get the most out of our platform.</p>
            </div>
            <div class="feature">
              <h3>🚀 Explore Features</h3>
              <p>Discover all the amazing features we have to offer.</p>
            </div>
            <div class="feature">
              <h3>🤝 Get Support</h3>
              <p>If you need any help, our support team is always ready to assist you.</p>
            </div>
            <div style="text-align: center;">
              <a href="{{dashboardUrl}}" class="button">Go to Dashboard</a>
            </div>
            <p>Thank you for joining us. We're excited to have you as part of our community!</p>
          </div>
          <div class="footer">
            <p>© 2025 Your App Name. All rights reserved.</p>
            <p>If you have any questions, contact us at sayyed.devwork@gmail.com</p>
          </div>
        </div>
      </body>
      </html>
    `,
  },
};

// Template rendering function
const renderTemplate = (template, data) => {
  let renderedTemplate = template;

  // Replace all placeholders with actual data
  Object.keys(data).forEach((key) => {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    renderedTemplate = renderedTemplate.replace(placeholder, data[key] || '');
  });

  return renderedTemplate;
};

// Main send email function
export const sendEmail = async (options) => {
  try {
    const transporter = createTransporter();

    // Verify transporter configuration
    await transporter.verify();
    console.log('✅ Gmail transporter is ready');

    let { to, subject, html, template, data = {} } = options;

    // If template is specified, use it
    if (template && emailTemplates[template]) {
      subject = emailTemplates[template].subject;
      html = renderTemplate(emailTemplates[template].html, data);
    }

    const mailOptions = {
      from: {
        name: process.env.EMAIL_FROM_NAME || 'Your App Name',
        address: process.env.EMAIL_USER || 'sayyed.devwork@gmail.com',
      },
      to,
      subject,
      html,
      // Add text version for better deliverability
      text: html.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
    };

    const info = await transporter.sendMail(mailOptions);

    console.log('✅ Email sent successfully:', {
      messageId: info.messageId,
      to: to,
      subject: subject,
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error('❌ Email sending failed:', error);

    // Log specific error types for debugging
    if (error.code === 'EAUTH') {
      console.error(
        'Authentication failed. Check your email credentials and app password.'
      );
    } else if (error.code === 'ECONNECTION') {
      console.error('Connection failed. Check your internet connection.');
    }

    throw new Error(`Email sending failed: ${error.message}`);
  }
};

// Utility functions for common email operations
export const sendVerificationEmail = async (user, verificationToken) => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

  return await sendEmail({
    to: user.email,
    template: 'emailVerification',
    data: {
      name: user.name,
      verificationUrl,
    },
  });
};

export const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  return await sendEmail({
    to: user.email,
    template: 'passwordReset',
    data: {
      name: user.name,
      resetUrl,
    },
  });
};

export const sendWelcomeEmail = async (user) => {
  const dashboardUrl = `${process.env.CLIENT_URL}/dashboard`;

  return await sendEmail({
    to: user.email,
    template: 'welcomeEmail',
    data: {
      name: user.name,
      dashboardUrl,
    },
  });
};

// Test email function
export const sendTestEmail = async () => {
  try {
    const result = await sendEmail({
      to: 'sayyed.devwork@gmail.com',
      subject: '🧪 Test Email - Configuration Working!',
      html: `
        <h2>✅ Gmail Configuration Test Successful!</h2>
        <p>If you're reading this, your Gmail email service is configured correctly.</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `,
    });

    console.log('✅ Test email sent successfully!');
    return result;
  } catch (error) {
    console.error('❌ Test email failed:', error);
    throw error;
  }
};
