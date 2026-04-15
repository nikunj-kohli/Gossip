const db = require('../config/database');
const { getMessagePreviewLabel } = require('../utils/messagePreview');

class Conversation {
    // Create a new conversation between users
    static async create({ creatorId, participantId, isAnonymous = false }) {
        try {
            console.log('=== CONVERSATION CREATE DEBUG ===');
            console.log('creatorId:', creatorId);
            console.log('participantId:', participantId);
            console.log('isAnonymous:', isAnonymous);
            
            // Check if conversation already exists
            const existingQuery = `
                SELECT id FROM conversations 
                WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
                LIMIT 1
            `;
            
            const existingResult = await db.query(existingQuery, [creatorId, participantId]);
            console.log('Existing conversation check:', existingResult.rows);
            
            if (existingResult.rows.length > 0) {
                console.log('Returning existing conversation:', existingResult.rows[0]);
                return existingResult.rows[0];
            }
            
            // Create new conversation
            console.log('Creating new conversation...');
            const conversationQuery = `
                INSERT INTO conversations (user1_id, user2_id, created_at, updated_at)
                VALUES ($1, $2, NOW(), NOW())
                RETURNING id, user1_id, user2_id, last_message_at, created_at, updated_at
            `;
            
            const result = await db.query(conversationQuery, [creatorId, participantId]);
            console.log('New conversation created:', result.rows[0]);
            return result.rows[0];
        } catch (error) {
            console.error('Error in Conversation.create:', error);
            console.error('Error details:', error.message);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }

    // Get conversation by ID
    static async findById(conversationId, userId) {
        try {
            // Check if user is part of the conversation
            const memberCheck = `
                SELECT * FROM conversations 
                WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)
            `;
            
            const memberResult = await db.query(memberCheck, [conversationId, userId]);
            
            if (memberResult.rows.length === 0) {
                throw new Error('User is not a member of this conversation');
            }
            
            const conversation = memberResult.rows[0];
            
            // Get the other participant
            const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;
            
            const participantQuery = `
                SELECT id, username, display_name, avatar_url
                FROM users
                WHERE id = $1
            `;
            
            const participantResult = await db.query(participantQuery, [otherUserId]);
            
            if (participantResult.rows.length > 0) {
                conversation.participants = [participantResult.rows[0]];
            } else {
                conversation.participants = [];
            }
            
            // Get unread count
            const unreadQuery = `
                SELECT COUNT(*) as unread_count
                FROM messages
                WHERE conversation_id = $1 
                AND sender_id != $2 
                AND is_read = false
            `;
            
            const unreadResult = await db.query(unreadQuery, [conversationId, userId]);
            conversation.unread_count = parseInt(unreadResult.rows[0].unread_count);
            
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
                SELECT id, user1_id, user2_id, last_message_at, created_at, updated_at
                FROM conversations 
                WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
                LIMIT 1
            `;
            
            const existingResult = await db.query(existingQuery, [userId1, userId2]);
            
            if (existingResult.rows.length > 0) {
                // Return existing conversation with basic info
                const conversation = existingResult.rows[0];
                
                // Get the other participant
                const otherUserId = conversation.user1_id === userId1 ? conversation.user2_id : conversation.user1_id;
                
                const participantQuery = `
                    SELECT id, username, display_name, avatar_url
                    FROM users
                    WHERE id = $1
                `;
                
                const participantResult = await db.query(participantQuery, [otherUserId]);
                
                if (participantResult.rows.length > 0) {
                    conversation.participants = [participantResult.rows[0]];
                } else {
                    conversation.participants = [];
                }
                
                // Get unread count
                const unreadQuery = `
                    SELECT COUNT(*) as unread_count
                    FROM messages
                    WHERE conversation_id = $1 
                    AND sender_id != $2 
                    AND is_read = false
                `;
                
                const unreadResult = await db.query(unreadQuery, [conversation.id, userId1]);
                conversation.unread_count = parseInt(unreadResult.rows[0].unread_count);
                
                return conversation;
            } else {
                // Create new conversation
                const conversation = await this.create({
                    creatorId: userId1,
                    participantId: userId2,
                    isAnonymous
                });
                
                // Return the new conversation with participant info
                const participantQuery = `
                    SELECT id, username, display_name, avatar_url
                    FROM users
                    WHERE id = $1
                `;
                
                const participantResult = await db.query(participantQuery, [userId2]);
                
                if (participantResult.rows.length > 0) {
                    conversation.participants = [participantResult.rows[0]];
                } else {
                    conversation.participants = [];
                }
                
                conversation.unread_count = 0;
                return conversation;
            }
        } catch (error) {
            console.error('Error in findOrCreateOneToOne:', error);
            throw error;
        }
    }

    // Get all conversations for a user
    static async getAllForUser(userId, limit = 20, offset = 0) {
        try {
            const query = `
                SELECT 
                    c.id, c.user1_id, c.user2_id, c.last_message_at, c.created_at, c.updated_at,
                    (
                        SELECT COUNT(*) 
                        FROM messages m 
                        WHERE m.conversation_id = c.id 
                        AND m.sender_id != $1 
                        AND m.is_read = false
                    ) as unread_count,
                    (
                        SELECT m.content
                        FROM messages m
                        WHERE m.conversation_id = c.id
                        ORDER BY m.created_at DESC, m.id DESC
                        LIMIT 1
                    ) as last_message_content,
                    (
                        SELECT m.message_type
                        FROM messages m
                        WHERE m.conversation_id = c.id
                        ORDER BY m.created_at DESC, m.id DESC
                        LIMIT 1
                    ) as last_message_type,
                    (
                        SELECT m.attachments
                        FROM messages m
                        WHERE m.conversation_id = c.id
                        ORDER BY m.created_at DESC, m.id DESC
                        LIMIT 1
                    ) as last_message_attachments
                FROM 
                    conversations c
                WHERE 
                    c.user1_id = $1 OR c.user2_id = $1
                ORDER BY 
                    c.last_message_at DESC NULLS LAST, c.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            let result;
            try {
                result = await db.query(query, [userId, limit, offset]);
            } catch (queryError) {
                const fallbackQuery = `
                    SELECT 
                        c.id, c.user1_id, c.user2_id, c.last_message_at, c.created_at, c.updated_at,
                        (
                            SELECT COUNT(*) 
                            FROM messages m 
                            WHERE m.conversation_id = c.id 
                            AND m.sender_id != $1 
                            AND m.is_read = false
                        ) as unread_count,
                        (
                            SELECT m.content
                            FROM messages m
                            WHERE m.conversation_id = c.id
                            ORDER BY m.created_at DESC, m.id DESC
                            LIMIT 1
                        ) as last_message_content
                    FROM 
                        conversations c
                    WHERE 
                        c.user1_id = $1 OR c.user2_id = $1
                    ORDER BY 
                        c.last_message_at DESC NULLS LAST, c.created_at DESC
                    LIMIT $2 OFFSET $3
                `;

                result = await db.query(fallbackQuery, [userId, limit, offset]);
            }
            
            // Get other participants for each conversation
            const conversations = [];
            
            for (const conversation of result.rows) {
                const otherUserId = conversation.user1_id === userId ? conversation.user2_id : conversation.user1_id;
                
                const participantsQuery = `
                    SELECT 
                        id, username, display_name, avatar_url
                    FROM 
                        users
                    WHERE 
                        id = $1
                `;
                
                const participantsResult = await db.query(participantsQuery, [otherUserId]);
                
                conversation.participants = participantsResult.rows;
                conversation.last_message = getMessagePreviewLabel({
                    content: conversation.last_message_content,
                    message_type: conversation.last_message_type,
                    attachments: conversation.last_message_attachments,
                });
                conversations.push(conversation);
            }
            
            // Get total count for pagination
            const countQuery = `
                SELECT COUNT(*) 
                FROM conversations c
                WHERE c.user1_id = $1 OR c.user2_id = $1
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

    // Leave a conversation (delete for 1-on-1 conversations)
    static async leave(conversationId, userId) {
        try {
            const query = `
                DELETE FROM conversations
                WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)
                RETURNING *
            `;
            
            const result = await db.query(query, [conversationId, userId]);
            
            if (result.rows.length === 0) {
                throw new Error('User is not a member of this conversation');
            }
            
            return { success: true };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Conversation;