const Queue = require('bull');
const config = require('../config/config');
const emailService = require('./emailService');
const User = require('../models/User');
const NotificationSettings = require('../models/NotificationSettings');

// Create queues
const emailQueue = new Queue('email-notifications', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password
  }
});

const pushQueue = new Queue('push-notifications', {
  redis: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password
  }
});

// Process email queue
emailQueue.process(async (job) => {
  try {
    const { userId, notification } = job.data;
    
    // Get user
    const user = await User.findById(userId);
    if (!user || !user.email) {
      throw new Error(`User not found or has no email: ${userId}`);
    }
    
    // Get notification settings
    const settings = await NotificationSettings.getByUserId(userId);
    
    // Check if email notifications are enabled for this type
    if (!settings.email_notifications || !settings[notification.type]) {
      return { skipped: true, reason: 'Email notifications disabled' };
    }
    
    // Send email notification
    const result = await emailService.sendNotificationEmail(user, notification);
    
    return { success: true, result };
  } catch (error) {
    console.error('Error processing email notification:', error);
    throw error;
  }
});

// Process push queue
pushQueue.process(async (job) => {
  try {
    const { userId, notification } = job.data;
    
    // Get notification settings
    const settings = await NotificationSettings.getByUserId(userId);
    
    // Check if push notifications are enabled for this type
    if (!settings.push_notifications || !settings[notification.type]) {
      return { skipped: true, reason: 'Push notifications disabled' };
    }
    
    // Get user's push tokens
    const tokens = await getPushTokensForUser(userId);
    
    if (!tokens.length) {
      return { skipped: true, reason: 'No push tokens available' };
    }
    
    // Send push notification to all user devices
    const results = await Promise.all(tokens.map(token => 
      sendPushNotification(token, notification)
    ));
    
    return { success: true, results };
  } catch (error) {
    console.error('Error processing push notification:', error);
    throw error;
  }
});

// Helper function to get push tokens for a user
async function getPushTokensForUser(userId) {
  try {
    const query = `
      SELECT token FROM user_push_tokens
      WHERE user_id = $1 AND is_active = true
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows.map(row => row.token);
  } catch (error) {
    console.error('Error getting push tokens:', error);
    return [];
  }
}

// Helper function to send push notification
async function sendPushNotification(token, notification) {
  try {
    // Implement your push notification provider here
    // This could be Firebase, OneSignal, etc.
    
    // Example with Firebase
    // const admin = require('firebase-admin');
    // return admin.messaging().send({
    //   token,
    //   notification: {
    //     title: notification.title,
    //     body: notification.body
    //   },
    //   data: {
    //     type: notification.type,
    //     link: notification.link,
    //     ...notification.data
    //   }
    // });
    
    // For now, we'll just return a mock success
    return { success: true, token };
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

// Queue a notification
const queueNotification = async (userId, notification) => {
  try {
    // First store the notification in database
    const db = require('../config/database');
    
    const insertQuery = `
      INSERT INTO notifications (
        user_id, type, title, body, link, data, is_read
      )
      VALUES ($1, $2, $3, $4, $5, $6, false)
      RETURNING id
    `;
    
    const values = [
      userId,
      notification.type,
      notification.title,
      notification.body,
      notification.link,
      JSON.stringify(notification.data || {})
    ];
    
    const result = await db.query(insertQuery, values);
    const notificationId = result.rows[0].id;
    
    // Add notification ID to the data
    notification.id = notificationId;
    
    // Queue email notification
    await emailQueue.add(
      { userId, notification },
      { 
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        }
      }
    );
    
    // Queue push notification
    await pushQueue.add(
      { userId, notification },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      }
    );
    
    // Emit real-time notification via WebSocket if user is online
    const socketManager = require('../utils/socketManager');
    socketManager.emitToUser(userId, 'notification:new', notification);
    
    return { success: true, notificationId };
  } catch (error) {
    console.error('Error queueing notification:', error);
    return { success: false, error };
  }
};

// Queue a bulk notification (to multiple users)
const queueBulkNotification = async (userIds, notification) => {
  try {
    const results = await Promise.all(
      userIds.map(userId => queueNotification(userId, notification))
    );
    
    return {
      success: true,
      results
    };
  } catch (error) {
    console.error('Error queueing bulk notification:', error);
    return { success: false, error };
  }
};

// Handle queue errors
emailQueue.on('failed', (job, error) => {
  console.error(`Email notification job ${job.id} failed:`, error);
});

pushQueue.on('failed', (job, error) => {
  console.error(`Push notification job ${job.id} failed:`, error);
});

module.exports = {
  queueNotification,
  queueBulkNotification,
  emailQueue,
  pushQueue
};