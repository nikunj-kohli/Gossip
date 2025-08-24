const db = require('../config/database');
const socketManager = require('../utils/socketManager');

class ChatMessage {
  // Create a new message
  static async create({ roomId, senderId, content, type = 'text', metadata = {} }) {
    try {
      // Insert message
      const query = `
        INSERT INTO chat_messages (room_id, sender_id, content, type, metadata)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const values = [roomId, senderId, content, type, JSON.stringify(metadata)];
      const result = await db.query(query, values);
      const message = result.rows[0];
      
      // Get sender info
      const userQuery = `
        SELECT id, username, display_name, avatar_url
        FROM users
        WHERE id = $1
      `;
      
      const userResult = await db.query(userQuery, [senderId]);
      const sender = userResult.rows[0];
      
      // Prepare full message object
      const fullMessage = {
        ...message,
        metadata: typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata,
        sender
      };
      
      // Send real-time notification to room members
      socketManager.emitToGroup(roomId, 'chat:message', fullMessage);
      
      return fullMessage;
    } catch (error) {
      throw error;
    }
  }

  // Get messages for a room
  static async findByRoom(roomId, userId, limit = 20, offset = 0) {
    try {
      // Verify user is a room member
      const memberQuery = `
        SELECT * FROM chat_room_members
        WHERE room_id = $1 AND user_id = $2
      `;
      
      const memberResult = await db.query(memberQuery, [roomId, userId]);
      
      if (memberResult.rows.length === 0) {
        throw new Error('User is not a member of this chat room');
      }
      
      // Get messages
      const query = `
        SELECT 
          m.*,
          json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url
          ) as sender
        FROM chat_messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.room_id = $1
        ORDER BY m.created_at DESC
        LIMIT $3 OFFSET $4
      `;
      
      const result = await db.query(query, [roomId, userId, limit, offset]);
      
      // Mark room as read
      await db.query(
        `UPDATE chat_room_members SET last_read_at = NOW() 
         WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId]
      );
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM chat_messages
        WHERE room_id = $1
      `;
      
      const countResult = await db.query(countQuery, [roomId]);
      const totalCount = parseInt(countResult.rows[0].count);
      
      // Parse metadata
      const messages = result.rows.map(msg => ({
        ...msg,
        metadata: typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata
      }));
      
      return {
        messages,
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

  // Delete a message
  static async delete(messageId, userId) {
    try {
      // Verify user can delete this message
      const checkQuery = `
        SELECT m.*, r.creator_id, rm.role
        FROM chat_messages m
        JOIN chat_rooms r ON m.room_id = r.id
        LEFT JOIN chat_room_members rm ON m.room_id = rm.room_id AND rm.user_id = $2
        WHERE m.id = $1
      `;
      
      const checkResult = await db.query(checkQuery, [messageId, userId]);
      
      if (checkResult.rows.length === 0) {
        throw new Error('Message not found');
      }
      
      const message = checkResult.rows[0];
      
      // Check if user can delete
      const canDelete = 
        message.sender_id === userId || // User's own message
        message.creator_id === userId || // Room creator
        message.role === 'admin' || // Room admin
        message.role === 'moderator'; // Room moderator
      
      if (!canDelete) {
        throw new Error('Not authorized to delete this message');
      }
      
      // Delete message
      const query = `
        UPDATE chat_messages
        SET is_deleted = true, content = '[Message deleted]'
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await db.query(query, [messageId]);
      
      // Notify room members
      socketManager.emitToGroup(message.room_id, 'chat:message_deleted', {
        messageId,
        roomId: message.room_id
      });
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Edit a message
  static async edit(messageId, userId, newContent) {
    try {
      // Verify user can edit this message
      const checkQuery = `
        SELECT * FROM chat_messages
        WHERE id = $1 AND sender_id = $2
      `;
      
      const checkResult = await db.query(checkQuery, [messageId, userId]);
      
      if (checkResult.rows.length === 0) {
        throw new Error('Message not found or not authorized to edit');
      }
      
      const message = checkResult.rows[0];
      
      // Edit message
      const query = `
        UPDATE chat_messages
        SET content = $3, is_edited = true, updated_at = NOW()
        WHERE id = $1 AND sender_id = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [messageId, userId, newContent]);
      
      // Get sender info
      const userQuery = `
        SELECT id, username, display_name, avatar_url
        FROM users
        WHERE id = $1
      `;
      
      const userResult = await db.query(userQuery, [userId]);
      const sender = userResult.rows[0];
      
      // Prepare full message object
      const fullMessage = {
        ...result.rows[0],
        metadata: typeof result.rows[0].metadata === 'string' 
          ? JSON.parse(result.rows[0].metadata) 
          : result.rows[0].metadata,
        sender
      };
      
      // Notify room members
      socketManager.emitToGroup(message.room_id, 'chat:message_updated', fullMessage);
      
      return fullMessage;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ChatMessage;