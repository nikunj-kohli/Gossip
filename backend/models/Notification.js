const db = require('../config/database');

class Notification {
    // Create a new notification
    static async create({ 
        userId, 
        actorId = null, 
        type, 
        entityType, 
        entityId, 
        message, 
        data = {}
    }) {
        try {
            // Skip if user has disabled this notification type
            const prefCheck = await db.query(
                `SELECT status FROM notification_preferences 
                WHERE user_id = $1 AND notification_type = $2`,
                [userId, type]
            );

            if (prefCheck.rows.length > 0 && prefCheck.rows[0].status === 'disabled') {
                return null; // User has disabled this notification type
            }

            const query = `
                INSERT INTO notifications 
                    (user_id, actor_id, type, entity_type, entity_id, message, data)
                VALUES 
                    ($1, $2, $3, $4, $5, $6, $7)
                RETURNING 
                    id, user_id, actor_id, type, entity_type, entity_id, 
                    message, data, is_read, created_at
            `;
            
            const values = [
                userId, 
                actorId, 
                type, 
                entityType, 
                entityId, 
                message, 
                JSON.stringify(data)
            ];
            
            const result = await db.query(query, values);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Get notifications for a user with pagination
    static async getForUser(userId, limit = 20, offset = 0) {
        try {
            const query = `
                SELECT 
                    n.id, n.type, n.entity_type, n.entity_id, n.message, 
                    n.data, n.is_read, n.created_at,
                    a.id as actor_id, a.username as actor_username, 
                    a.display_name as actor_display_name, a.avatar_url as actor_avatar
                FROM 
                    notifications n
                LEFT JOIN 
                    users a ON n.actor_id = a.id
                WHERE 
                    n.user_id = $1
                ORDER BY 
                    n.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            const result = await db.query(query, [userId, limit, offset]);
            
            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) FROM notifications WHERE user_id = $1
            `;
            const countResult = await db.query(countQuery, [userId]);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                notifications: result.rows.map(notification => ({
                    ...notification,
                    data: typeof notification.data === 'string' 
                        ? JSON.parse(notification.data) 
                        : notification.data
                })),
                pagination: {
                    total: totalCount,
                    limit,
                    offset
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Get unread notifications count
    static async getUnreadCount(userId) {
        try {
            const query = `
                SELECT COUNT(*) FROM notifications 
                WHERE user_id = $1 AND is_read = false
            `;
            
            const result = await db.query(query, [userId]);
            return parseInt(result.rows[0].count);
        } catch (error) {
            throw error;
        }
    }

    // Mark notification as read
    static async markAsRead(notificationId, userId) {
        try {
            const query = `
                UPDATE notifications
                SET is_read = true
                WHERE id = $1 AND user_id = $2
                RETURNING id, is_read
            `;
            
            const result = await db.query(query, [notificationId, userId]);
            
            if (result.rows.length === 0) {
                throw new Error('Notification not found or does not belong to user');
            }
            
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Mark all notifications as read
    static async markAllAsRead(userId) {
        try {
            const query = `
                UPDATE notifications
                SET is_read = true
                WHERE user_id = $1 AND is_read = false
                RETURNING id
            `;
            
            const result = await db.query(query, [userId]);
            return { updatedCount: result.rowCount };
        } catch (error) {
            throw error;
        }
    }

    // Delete a notification
    static async delete(notificationId, userId) {
        try {
            const query = `
                DELETE FROM notifications
                WHERE id = $1 AND user_id = $2
                RETURNING id
            `;
            
            const result = await db.query(query, [notificationId, userId]);
            
            if (result.rows.length === 0) {
                throw new Error('Notification not found or does not belong to user');
            }
            
            return { success: true };
        } catch (error) {
            throw error;
        }
    }

    // Delete all notifications for a user
    static async deleteAll(userId) {
        try {
            const query = `
                DELETE FROM notifications
                WHERE user_id = $1
                RETURNING id
            `;
            
            const result = await db.query(query, [userId]);
            return { deletedCount: result.rowCount };
        } catch (error) {
            throw error;
        }
    }

    // Get notification preferences for a user
    static async getPreferences(userId) {
        try {
            const query = `
                SELECT notification_type, status
                FROM notification_preferences
                WHERE user_id = $1
            `;
            
            const result = await db.query(query, [userId]);
            
            // If no preferences found, return defaults
            if (result.rows.length === 0) {
                const defaultTypes = [
                    'like', 'comment', 'friend_request', 
                    'friend_accepted', 'post_mention', 'comment_mention',
                    'group_invite', 'group_post'
                ];
                
                return defaultTypes.map(type => ({
                    notification_type: type,
                    status: 'enabled'
                }));
            }
            
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    // Update notification preference
    static async updatePreference(userId, notificationType, status) {
        try {
            // Validate status
            if (!['enabled', 'disabled'].includes(status)) {
                throw new Error('Invalid status value');
            }
            
            // Validate notification type
            const validTypes = [
                'like', 'comment', 'friend_request', 
                'friend_accepted', 'post_mention', 'comment_mention',
                'group_invite', 'group_post'
            ];
            
            if (!validTypes.includes(notificationType)) {
                throw new Error('Invalid notification type');
            }
            
            // Upsert preference
            const query = `
                INSERT INTO notification_preferences (user_id, notification_type, status)
                VALUES ($1, $2, $3)
                ON CONFLICT (user_id, notification_type) 
                DO UPDATE SET status = $3
                RETURNING notification_type, status
            `;
            
            const result = await db.query(query, [userId, notificationType, status]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Notification;