const db = require('../config/database');

class Message {
    // Create a new message
    static async create({ senderId, conversationId, content, isAnonymous = false }) {
        try {
            const query = `
                INSERT INTO messages 
                    (sender_id, conversation_id, content, is_anonymous)
                VALUES 
                    ($1, $2, $3, $4)
                RETURNING 
                    id, sender_id, conversation_id, content, is_anonymous, 
                    is_read, created_at, updated_at
            `;
            
            const values = [senderId, conversationId, content, isAnonymous];
            const result = await db.query(query, values);
            
            // Update conversation's last_message_at
            await db.query(
                `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
                [conversationId]
            );
            
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Get messages from a conversation with pagination
    static async getByConversation(conversationId, userId, limit = 20, offset = 0) {
        try {
            // First check if user is part of this conversation
            const memberCheck = await db.query(
                `SELECT * FROM conversation_members WHERE conversation_id = $1 AND user_id = $2`,
                [conversationId, userId]
            );
            
            if (memberCheck.rows.length === 0) {
                throw new Error('User is not a member of this conversation');
            }
            
            // Get messages
            const query = `
                SELECT 
                    m.id, m.content, m.is_anonymous, m.is_read, m.created_at,
                    m.sender_id,
                    CASE 
                        WHEN m.is_anonymous = true THEN NULL
                        ELSE u.username 
                    END AS sender_username,
                    CASE 
                        WHEN m.is_anonymous = true THEN 'Anonymous'
                        ELSE u.display_name 
                    END AS sender_display_name,
                    CASE 
                        WHEN m.is_anonymous = true THEN NULL
                        ELSE u.avatar_url 
                    END AS sender_avatar
                FROM 
                    messages m
                LEFT JOIN 
                    users u ON m.sender_id = u.id
                WHERE 
                    m.conversation_id = $1
                ORDER BY 
                    m.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            const result = await db.query(query, [conversationId, limit, offset]);
            
            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) FROM messages WHERE conversation_id = $1
            `;
            const countResult = await db.query(countQuery, [conversationId]);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                messages: result.rows,
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

    // Mark message as read
    static async markAsRead(messageId, userId) {
        try {
            // Verify user is the recipient
            const verifyQuery = `
                SELECT cm.user_id, m.sender_id
                FROM messages m
                JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
                WHERE m.id = $1 AND cm.user_id = $2 AND m.sender_id != $2
            `;
            
            const verifyResult = await db.query(verifyQuery, [messageId, userId]);
            
            if (verifyResult.rows.length === 0) {
                throw new Error('User cannot mark this message as read');
            }
            
            const query = `
                UPDATE messages
                SET is_read = true, updated_at = NOW()
                WHERE id = $1
                RETURNING id, is_read, updated_at
            `;
            
            const result = await db.query(query, [messageId]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Mark all messages in a conversation as read
    static async markAllAsRead(conversationId, userId) {
        try {
            // Verify user is a member of the conversation
            const verifyQuery = `
                SELECT * FROM conversation_members 
                WHERE conversation_id = $1 AND user_id = $2
            `;
            
            const verifyResult = await db.query(verifyQuery, [conversationId, userId]);
            
            if (verifyResult.rows.length === 0) {
                throw new Error('User is not a member of this conversation');
            }
            
            const query = `
                UPDATE messages
                SET is_read = true, updated_at = NOW()
                WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
                RETURNING id
            `;
            
            const result = await db.query(query, [conversationId, userId]);
            return { updatedCount: result.rowCount };
        } catch (error) {
            throw error;
        }
    }

    // Delete a message (soft delete)
    static async delete(messageId, userId) {
        try {
            // Verify user is the sender
            const verifyQuery = `
                SELECT * FROM messages WHERE id = $1 AND sender_id = $2
            `;
            
            const verifyResult = await db.query(verifyQuery, [messageId, userId]);
            
            if (verifyResult.rows.length === 0) {
                throw new Error('User can only delete their own messages');
            }
            
            // Soft delete
            const query = `
                UPDATE messages
                SET is_deleted = true, updated_at = NOW()
                WHERE id = $1
                RETURNING id
            `;
            
            const result = await db.query(query, [messageId]);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Get unread message count for a user
    static async getUnreadCount(userId) {
        try {
            const query = `
                SELECT COUNT(*) 
                FROM messages m
                JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
                WHERE cm.user_id = $1 AND m.sender_id != $1 AND m.is_read = false AND m.is_deleted = false
            `;
            
            const result = await db.query(query, [userId]);
            return parseInt(result.rows[0].count);
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Message;