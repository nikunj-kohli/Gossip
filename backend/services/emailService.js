const nodemailer = require('nodemailer');
const config = require('../config/config');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

// Create transporter
let transporter;

// Initialize different transporters based on environment
if (process.env.NODE_ENV === 'production') {
  // Production transporter (e.g., SendGrid, AWS SES, etc.)
  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.auth.user,
      pass: config.email.auth.pass
    }
  });
} else {
  // Development transporter (e.g., Ethereal, Mailtrap, etc.)
  transporter = nodemailer.createTransport({
    host: config.email.devHost,
    port: config.email.devPort,
    secure: config.email.devSecure,
    auth: {
      user: config.email.devAuth.user,
      pass: config.email.devAuth.pass
    }
  });
}

// Cache for compiled templates
const templateCache = {};

// Load and compile email template
const loadTemplate = (templateName) => {
  if (templateCache[templateName]) {
    return templateCache[templateName];
  }

  const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.html`);
  const templateSource = fs.readFileSync(templatePath, 'utf-8');
  const template = handlebars.compile(templateSource);
  
  templateCache[templateName] = template;
  return template;
};

// Send email
const sendEmail = async (to, subject, templateName, context = {}) => {
  try {
    // Add common variables to context
    const fullContext = {
      ...context,
      appName: config.appName,
      appUrl: config.clientUrl,
      year: new Date().getFullYear()
    };
    
    // Compile template
    const template = loadTemplate(templateName);
    const html = template(fullContext);
    
    // Send email
    const result = await transporter.sendMail({
      from: `"${config.appName}" <${config.email.from}>`,
      to,
      subject,
      html
    });
    
    console.log(`Email sent to ${to}: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
};

// Send welcome email
const sendWelcomeEmail = async (user) => {
  return sendEmail(
    user.email,
    `Welcome to ${config.appName}!`,
    'welcome',
    {
      username: user.username,
      displayName: user.display_name || user.username,
      verificationUrl: `${config.clientUrl}/verify-email?token=${user.verification_token}`
    }
  );
};

// Send password reset email
const sendPasswordResetEmail = async (user, resetToken) => {
  return sendEmail(
    user.email,
    `Reset Your ${config.appName} Password`,
    'password-reset',
    {
      username: user.username,
      displayName: user.display_name || user.username,
      resetUrl: `${config.clientUrl}/reset-password?token=${resetToken}`
    }
  );
};

// Send verification email
const sendVerificationEmail = async (user) => {
  return sendEmail(
    user.email,
    `Verify Your ${config.appName} Email`,
    'email-verification',
    {
      username: user.username,
      displayName: user.display_name || user.username,
      verificationUrl: `${config.clientUrl}/verify-email?token=${user.verification_token}`
    }
  );
};

// Send notification email
const sendNotificationEmail = async (user, notification) => {
  // Check user notification preferences
  const preferences = await getUserNotificationPreferences(user.id);
  
  if (!preferences[notification.type]) {
    return { success: false, reason: 'User has disabled this notification type' };
  }
  
  // Get appropriate template and subject based on notification type
  const templateMap = {
    'friend_request': { template: 'notification-friend-request', subject: 'New Friend Request' },
    'message': { template: 'notification-message', subject: 'New Message' },
    'comment': { template: 'notification-comment', subject: 'New Comment on Your Post' },
    'like': { template: 'notification-like', subject: 'Someone Liked Your Post' },
    'mention': { template: 'notification-mention', subject: 'You Were Mentioned' },
    'group_invite': { template: 'notification-group-invite', subject: 'New Group Invitation' }
  };
  
  const { template, subject } = templateMap[notification.type] || { 
    template: 'notification-generic', 
    subject: 'New Notification' 
  };
  
  return sendEmail(
    user.email,
    `${config.appName}: ${subject}`,
    template,
    {
      username: user.username,
      displayName: user.display_name || user.username,
      ...notification.data,
      notificationUrl: `${config.clientUrl}${notification.link}`
    }
  );
};

// Get user notification preferences
const getUserNotificationPreferences = async (userId) => {
  try {
    const db = require('../config/database');
    
    const query = `
      SELECT * FROM user_notification_settings
      WHERE user_id = $1
    `;
    
    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      // Return default preferences if not set
      return {
        friend_request: true,
        message: true,
        comment: true,
        like: true,
        mention: true,
        group_invite: true
      };
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user notification preferences:', error);
    // Return all enabled by default in case of error
    return {
      friend_request: true,
      message: true,
      comment: true,
      like: true,
      mention: true,
      group_invite: true
    };
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendNotificationEmail
};