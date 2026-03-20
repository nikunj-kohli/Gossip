const db = require('../config/database');

class Message {
    // Create a new message
    static async create({ senderId, conversationId, content, messageType = 'text', isAnonymous = false }) {
        try {
            const query = `
                INSERT INTO messages 
                    (sender_id, conversation_id, content, message_type)
                VALUES 
                    ($1, $2, $3, $4)
                RETURNING 
                    id, sender_id, conversation_id, content, message_type,
                    is_read, created_at, updated_at
            `;
            
            const values = [senderId, conversationId, content, messageType];
            const result = await db.query(query, values);
            
            // Update conversation's last_message_at
            await db.query(
                `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
                [conversationId]
            );
            
            // Format timestamp to ISO string for consistent frontend handling
            const message = result.rows[0];
            return {
                ...message,
                created_at: message.created_at.toISOString()
            };
        } catch (error) {
            throw error;
        }
    }

    // Get messages from a conversation with pagination
    static async getByConversation(conversationId, userId, limit = 20, offset = 0) {
        try {
            // First check if user is part of this conversation
            const memberCheck = await db.query(
                `SELECT * FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
                [conversationId, userId]
            );
            
            if (memberCheck.rows.length === 0) {
                throw new Error('User is not a member of this conversation');
            }
            
            // Get messages
            const query = `
                SELECT 
                    m.id, m.content, m.is_read, m.created_at, m.message_type,
                    m.sender_id,
                    u.username, u.display_name, u.avatar_url
                FROM 
                    messages m
                JOIN 
                    users u ON m.sender_id = u.id
                WHERE 
                    m.conversation_id = $1
                ORDER BY 
                    m.created_at ASC
                LIMIT $2 OFFSET $3
            `;
            
            const result = await db.query(query, [conversationId, limit, offset]);
            
            // Format timestamps to ISO strings for consistent frontend handling
            return result.rows.map(message => ({
                ...message,
                created_at: message.created_at.toISOString()
            }));
        } catch (error) {
            throw error;
        }
    }

    // Mark a message as read
    static async markAsRead(messageId, userId) {
        try {
            const query = `
                UPDATE messages 
                SET is_read = true, read_at = NOW()
                WHERE id = $1 AND sender_id != $2
                RETURNING *
            `;
            
            const result = await db.query(query, [messageId, userId]);
            
            if (result.rows.length === 0) {
                throw new Error('User cannot mark this message as read');
            }
            
            return { success: true, message: result.rows[0] };
        } catch (error) {
            throw error;
        }
    }

    // Mark all messages in a conversation as read for a user
    static async markAllAsRead(conversationId, userId) {
        try {
            // First check if user is part of this conversation
            const memberCheck = await db.query(
                `SELECT * FROM conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)`,
                [conversationId, userId]
            );
            
            if (memberCheck.rows.length === 0) {
                throw new Error('User is not a member of this conversation');
            }
            
            const query = `
                UPDATE messages 
                SET is_read = true, read_at = NOW()
                WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
                RETURNING *
            `;
            
            const result = await db.query(query, [conversationId, userId]);
            
            return { 
                success: true, 
                messagesMarked: result.rows.length,
                messages: result.rows 
            };
        } catch (error) {
            throw error;
        }
    }

    // Delete a message (soft delete by marking as deleted)
    static async delete(messageId, userId) {
        try {
            const query = `
                UPDATE messages 
                SET content = '[Message deleted]', updated_at = NOW()
                WHERE id = $1 AND sender_id = $2
                RETURNING *
            `;
            
            const result = await db.query(query, [messageId, userId]);
            
            if (result.rows.length === 0) {
                throw new Error('User can only delete their own messages');
            }
            
            return { success: true, message: result.rows[0] };
        } catch (error) {
            throw error;
        }
    }

    // Get unread message count for a user
    static async getUnreadCount(userId) {
        try {
            const query = `
                SELECT COUNT(*) as count
                FROM messages m
                JOIN conversations c ON m.conversation_id = c.id
                WHERE (c.user1_id = $1 OR c.user2_id = $1)
                AND m.sender_id != $1
                AND m.is_read = false
            `;
            
            const result = await db.query(query, [userId]);
            return parseInt(result.rows[0].count);
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Message;
