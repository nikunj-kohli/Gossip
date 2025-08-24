const db = require('../config/database');

class NotificationSettings {
  // Get user notification settings
  static async getByUserId(userId) {
    try {
      const query = `
        SELECT * FROM user_notification_settings
        WHERE user_id = $1
      `;
      
      const result = await db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        // Return default settings
        return this.getDefaultSettings(userId);
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get default notification settings
  static getDefaultSettings(userId) {
    return {
      user_id: userId,
      email_notifications: true,
      push_notifications: true,
      friend_request: true,
      message: true,
      comment: true,
      like: true,
      mention: true,
      group_invite: true,
      daily_digest: false,
      marketing_emails: true,
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  // Create or update notification settings
  static async upsert(userId, settings) {
    try {
      const currentSettings = await this.getByUserId(userId);
      
      // Prepare updated settings (merge with current)
      const updatedSettings = {
        ...currentSettings,
        ...settings,
        updated_at: new Date()
      };
      
      // Remove user_id and timestamps from the update data
      const { user_id, created_at, updated_at, ...updateData } = updatedSettings;
      
      // Build query dynamically
      const columns = Object.keys(updateData);
      const values = columns.map(col => updateData[col]);
      
      // Construct placeholders for values
      const placeholders = values.map((_, i) => `$${i + 2}`).join(', ');
      const columnAssignments = columns.map((col, i) => `${col} = $${i + 2}`).join(', ');
      
      const query = `
        INSERT INTO user_notification_settings (
          user_id, ${columns.join(', ')}
        )
        VALUES ($1, ${placeholders})
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          ${columnAssignments},
          updated_at = NOW()
        RETURNING *
      `;
      
      const result = await db.query(query, [userId, ...values]);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Update email notification settings
  static async updateEmailSettings(userId, emailSettings) {
    try {
      const validSettings = [
        'email_notifications',
        'friend_request',
        'message',
        'comment',
        'like',
        'mention',
        'group_invite',
        'daily_digest',
        'marketing_emails'
      ];
      
      // Filter out invalid settings
      const filteredSettings = Object.keys(emailSettings)
        .filter(key => validSettings.includes(key))
        .reduce((obj, key) => {
          obj[key] = emailSettings[key];
          return obj;
        }, {});
      
      return await this.upsert(userId, filteredSettings);
    } catch (error) {
      throw error;
    }
  }

  // Update push notification settings
  static async updatePushSettings(userId, pushSettings) {
    try {
      const validSettings = [
        'push_notifications',
        'friend_request',
        'message',
        'comment',
        'like',
        'mention',
        'group_invite'
      ];
      
      // Filter out invalid settings
      const filteredSettings = Object.keys(pushSettings)
        .filter(key => validSettings.includes(key))
        .reduce((obj, key) => {
          obj[key] = pushSettings[key];
          return obj;
        }, {});
      
      return await this.upsert(userId, filteredSettings);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = NotificationSettings;