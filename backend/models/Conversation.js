const db = require('../config/database');

class Conversation {
    // Create a new conversation between users
    static async create({ creatorId, participantId, isAnonymous = false }) {
        try {
            // Start transaction
            await db.query('BEGIN');
            
            // Create conversation
            const conversationQuery = `
                INSERT INTO conversations (created_by, is_anonymous)
                VALUES ($1, $2)
                RETURNING id, created_by, is_anonymous, created_at, last_message_at
            `;
            
            const conversationResult = await db.query(conversationQuery, [creatorId, isAnonymous]);
            const conversation = conversationResult.rows[0];
            
            // Add members to conversation
            const memberQuery = `
                INSERT INTO conversation_members (conversation_id, user_id)
                VALUES ($1, $2), ($1, $3)
            `;
            
            await db.query(memberQuery, [conversation.id, creatorId, participantId]);
            
            // Commit transaction
            await db.query('COMMIT');
            
            return conversation;
        } catch (error) {
            // Rollback in case of error
            await db.query('ROLLBACK');
            throw error;
        }
    }

    // Get conversation by ID
    static async findById(conversationId, userId) {
        try {
            // Check if user is part of the conversation
            const memberCheck = `
                SELECT * FROM conversation_members 
                WHERE conversation_id = $1 AND user_id = $2
            `;
            
            const memberResult = await db.query(memberCheck, [conversationId, userId]);
            
            if (memberResult.rows.length === 0) {
                throw new Error('User is not a member of this conversation');
            }
            
            // Get conversation details
            const query = `
                SELECT 
                    c.id, c.created_at, c.last_message_at, c.is_anonymous,
                    (
                        SELECT COUNT(*) 
                        FROM messages m 
                        WHERE m.conversation_id = c.id 
                        AND m.sender_id != $2 
                        AND m.is_read = false
                        AND m.is_deleted = false
                    ) as unread_count
                FROM 
                    conversations c
                WHERE 
                    c.id = $1
            `;
            
            const result = await db.query(query, [conversationId, userId]);
            
            if (result.rows.length === 0) {
                return null;
            }
            
            // Get other participants
            const participantsQuery = `
                SELECT 
                    u.id, u.username, u.display_name, u.avatar_url
                FROM 
                    conversation_members cm
                JOIN 
                    users u ON cm.user_id = u.id
                WHERE 
                    cm.conversation_id = $1
                    AND cm.user_id != $2
            `;
            
            const participantsResult = await db.query(participantsQuery, [conversationId, userId]);
            
            const conversation = result.rows[0];
            conversation.participants = participantsResult.rows;
            
            return conversation;
        } catch (error) {
            throw error;
        }
    }

    // Get conversation between two users (or create if doesn't exist)
    static async findOrCreateOneToOne(userId1, userId2, isAnonymous = false) {
        try {
            // Check if conversation already exists
            const existingQuery = `
                SELECT c.id
                FROM conversations c
                JOIN conversation_members cm1 ON c.id = cm1.conversation_id
                JOIN conversation_members cm2 ON c.id = cm2.conversation_id
                WHERE cm1.user_id = $1 AND cm2.user_id = $2
                AND (SELECT COUNT(*) FROM conversation_members WHERE conversation_id = c.id) = 2
                LIMIT 1
            `;
            
            const existingResult = await db.query(existingQuery, [userId1, userId2]);
            
            if (existingResult.rows.length > 0) {
                // Return existing conversation
                return this.findById(existingResult.rows[0].id, userId1);
            } else {
                // Create new conversation
                return this.create({
                    creatorId: userId1,
                    participantId: userId2,
                    isAnonymous
                });
            }
        } catch (error) {
            throw error;
        }
    }

    // Get all conversations for a user
    static async getAllForUser(userId, limit = 20, offset = 0) {
        try {
            const query = `
                SELECT 
                    c.id, c.created_at, c.last_message_at, c.is_anonymous,
                    (
                        SELECT COUNT(*) 
                        FROM messages m 
                        WHERE m.conversation_id = c.id 
                        AND m.sender_id != $1 
                        AND m.is_read = false
                        AND m.is_deleted = false
                    ) as unread_count,
                    (
                        SELECT m.content
                        FROM messages m
                        WHERE m.conversation_id = c.id
                        AND m.is_deleted = false
                        ORDER BY m.created_at DESC
                        LIMIT 1
                    ) as last_message
                FROM 
                    conversations c
                JOIN 
                    conversation_members cm ON c.id = cm.conversation_id
                WHERE 
                    cm.user_id = $1
                ORDER BY 
                    c.last_message_at DESC NULLS LAST
                LIMIT $2 OFFSET $3
            `;
            
            const result = await db.query(query, [userId, limit, offset]);
            
            // Get other participants for each conversation
            const conversations = [];
            
            for (const conversation of result.rows) {
                const participantsQuery = `
                    SELECT 
                        u.id, u.username, u.display_name, u.avatar_url
                    FROM 
                        conversation_members cm
                    JOIN 
                        users u ON cm.user_id = u.id
                    WHERE 
                        cm.conversation_id = $1
                        AND cm.user_id != $2
                `;
                
                const participantsResult = await db.query(participantsQuery, [conversation.id, userId]);
                
                conversation.participants = participantsResult.rows;
                conversations.push(conversation);
            }
            
            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) 
                FROM conversations c
                JOIN conversation_members cm ON c.id = cm.conversation_id
                WHERE cm.user_id = $1
            `;
            
            const countResult = await db.query(countQuery, [userId]);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                conversations,
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

    // Leave a conversation
    static async leave(conversationId, userId) {
        try {
            const query = `
                DELETE FROM conversation_members
                WHERE conversation_id = $1 AND user_id = $2
                RETURNING *
            `;
            
            const result = await db.query(query, [conversationId, userId]);
            
            if (result.rows.length === 0) {
                throw new Error('User is not a member of this conversation');
            }
            
            // Check if conversation is now empty
            const checkEmptyQuery = `
                SELECT COUNT(*) FROM conversation_members
                WHERE conversation_id = $1
            `;
            
            const checkResult = await db.query(checkEmptyQuery, [conversationId]);
            
            if (parseInt(checkResult.rows[0].count) === 0) {
                // Delete conversation if empty
                await db.query('DELETE FROM conversations WHERE id = $1', [conversationId]);
            }
            
            return { success: true };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Conversation;