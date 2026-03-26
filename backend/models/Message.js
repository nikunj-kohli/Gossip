const db = require('../config/database');

class Message {
    static safeParseJson(value, fallbackValue) {
        try {
            return JSON.parse(value);
        } catch (e) {
            return fallbackValue;
        }
    }

    static normalizeMessageRow(row) {
        const LEGACY_PREFIX = '__GOSSIP_MEDIA__';
        let content = row.content || '';

        let attachments = [];
        if (Array.isArray(row.attachments)) {
            attachments = row.attachments;
        } else if (typeof row.attachments === 'string') {
            attachments = Message.safeParseJson(row.attachments || '[]', []);
        } else if (row.attachments && typeof row.attachments === 'object') {
            attachments = [row.attachments];
        }

        if ((!Array.isArray(attachments) || attachments.length === 0)
            && typeof content === 'string'
            && content.startsWith(LEGACY_PREFIX)) {
            const encodedPayload = content.slice(LEGACY_PREFIX.length);
            const legacyPayload = Message.safeParseJson(encodedPayload, null);
            if (legacyPayload && typeof legacyPayload === 'object') {
                attachments = Array.isArray(legacyPayload.attachments) ? legacyPayload.attachments : [];
                content = legacyPayload.text || '';
            }
        }

        return {
            ...row,
            content,
            attachments: Array.isArray(attachments) ? attachments : [],
            created_at: row.created_at.toISOString(),
            // Ensure consistent field naming for frontend
            messageType: row.message_type || (attachments.length > 0 ? 'media' : 'text'),
            message_type: row.message_type || (attachments.length > 0 ? 'media' : 'text')
        };
    }

    static async findById(messageId) {
        const result = await db.query(
            `SELECT * FROM messages WHERE id = $1`,
            [messageId]
        );
        return result.rows[0] || null;
    }

    // Create a new message
    static async create({ senderId, conversationId, content, messageType = 'text', isAnonymous = false, attachments = [] }) {
        try {
            let result;

            try {
                const query = `
                    INSERT INTO messages 
                        (sender_id, conversation_id, content, message_type, attachments)
                    VALUES 
                        ($1, $2, $3, $4, $5)
                    RETURNING 
                        id, sender_id, conversation_id, content, message_type, attachments,
                        is_read, created_at, updated_at
                `;

                const values = [senderId, conversationId, content, messageType, JSON.stringify(attachments || [])];
                result = await db.query(query, values);
            } catch (insertError) {
                // Fallback for environments where attachment/message_type migration is not yet applied.
                const LEGACY_PREFIX = '__GOSSIP_MEDIA__';
                const fallbackContent = (Array.isArray(attachments) && attachments.length > 0)
                    ? `${LEGACY_PREFIX}${JSON.stringify({ text: content, attachments })}`
                    : content;

                const fallbackQuery = `
                    INSERT INTO messages 
                        (sender_id, conversation_id, content)
                    VALUES 
                        ($1, $2, $3)
                    RETURNING 
                        id, sender_id, conversation_id, content,
                        is_read, created_at, updated_at
                `;

                const fallbackValues = [senderId, conversationId, fallbackContent];
                result = await db.query(fallbackQuery, fallbackValues);
            }
            
            // Update conversation's last_message_at
            await db.query(
                `UPDATE conversations SET last_message_at = NOW() WHERE id = $1`,
                [conversationId]
            );
            
            // Format timestamp to ISO string for consistent frontend handling
            const message = result.rows[0];
            return Message.normalizeMessageRow(message);
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
            let result;

            try {
                const query = `
                    SELECT 
                        m.id, m.content, m.is_read, m.created_at, m.message_type, m.attachments,
                        m.sender_id,
                        u.username, u.display_name, u.avatar_url
                    FROM 
                        messages m
                    JOIN 
                        users u ON m.sender_id = u.id
                    WHERE 
                        m.conversation_id = $1
                    ORDER BY 
                        m.created_at DESC, m.id DESC
                    LIMIT $2 OFFSET $3
                `;

                result = await db.query(query, [conversationId, limit, offset]);
            } catch (selectError) {
                const fallbackQuery = `
                    SELECT 
                        m.id, m.content, m.is_read, m.created_at,
                        m.sender_id,
                        u.username, u.display_name, u.avatar_url
                    FROM 
                        messages m
                    JOIN 
                        users u ON m.sender_id = u.id
                    WHERE 
                        m.conversation_id = $1
                    ORDER BY 
                        m.created_at DESC, m.id DESC
                    LIMIT $2 OFFSET $3
                `;

                result = await db.query(fallbackQuery, [conversationId, limit, offset]);
            }

            // Fetch latest messages first for correct pagination, then display oldest->newest in UI.
            const orderedRows = result.rows.slice().reverse();
            
            // Format timestamps to ISO strings for consistent frontend handling
            return orderedRows.map((message) => Message.normalizeMessageRow(message));
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
            let result;
            try {
                const query = `
                    UPDATE messages 
                    SET content = '[Message deleted]', attachments = '[]'::jsonb, message_type = 'text', updated_at = NOW()
                    WHERE id = $1 AND sender_id = $2
                    RETURNING *
                `;
                result = await db.query(query, [messageId, userId]);
            } catch (updateError) {
                const fallbackQuery = `
                    UPDATE messages 
                    SET content = '[Message deleted]', updated_at = NOW()
                    WHERE id = $1 AND sender_id = $2
                    RETURNING *
                `;
                result = await db.query(fallbackQuery, [messageId, userId]);
            }
            
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
