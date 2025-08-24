const db = require('../config/database');
const socketManager = require('../utils/socketManager');

class ChatRoom {
  // Create a new chat room
  static async create({ name, type, creatorId, userIds, isPrivate = false }) {
    try {
      await db.query('BEGIN');
      
      // Create the chat room
      const roomQuery = `
        INSERT INTO chat_rooms (name, type, creator_id, is_private)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const roomResult = await db.query(roomQuery, [name, type, creatorId, isPrivate]);
      const room = roomResult.rows[0];
      
      // Add members to the room
      const memberValues = [creatorId, ...userIds.filter(id => id !== creatorId)];
      
      for (const userId of memberValues) {
        await db.query(
          `INSERT INTO chat_room_members (room_id, user_id) VALUES ($1, $2)`,
          [room.id, userId]
        );
      }
      
      await db.query('COMMIT');
      
      // Notify all members about the new room
      for (const userId of memberValues) {
        socketManager.emitToUser(userId, 'chat:room_created', {
          roomId: room.id,
          name: room.name,
          type: room.type
        });
      }
      
      return room;
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  // Get chat room by ID
  static async findById(roomId, userId = null) {
    try {
      let query = `
        SELECT 
          r.*,
          COALESCE(
            (SELECT COUNT(*) FROM chat_room_members WHERE room_id = r.id),
            0
          ) as member_count
      `;
      
      // If userId is provided, check membership
      if (userId) {
        query += `,
          (SELECT COUNT(*) > 0 FROM chat_room_members 
           WHERE room_id = r.id AND user_id = $2) as is_member
        `;
      }
      
      query += `
        FROM chat_rooms r
        WHERE r.id = $1
      `;
      
      const params = userId ? [roomId, userId] : [roomId];
      const result = await db.query(query, params);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get chat rooms for a user
  static async findByUser(userId, limit = 20, offset = 0) {
    try {
      const query = `
        SELECT 
          r.*,
          COALESCE(
            (SELECT COUNT(*) FROM chat_room_members WHERE room_id = r.id),
            0
          ) as member_count,
          (
            SELECT COUNT(*) FROM chat_messages cm
            WHERE cm.room_id = r.id
            AND cm.created_at > (
              SELECT COALESCE(last_read_at, '1970-01-01'::timestamp)
              FROM chat_room_members
              WHERE room_id = r.id AND user_id = $1
            )
            AND cm.sender_id != $1
          ) as unread_count,
          (
            SELECT row_to_json(msg) FROM (
              SELECT 
                cm.id, cm.content, cm.created_at,
                json_build_object(
                  'id', u.id,
                  'username', u.username,
                  'display_name', u.display_name,
                  'avatar_url', u.avatar_url
                ) as sender
              FROM chat_messages cm
              JOIN users u ON cm.sender_id = u.id
              WHERE cm.room_id = r.id
              ORDER BY cm.created_at DESC
              LIMIT 1
            ) msg
          ) as last_message
        FROM chat_rooms r
        JOIN chat_room_members m ON r.id = m.room_id
        WHERE m.user_id = $1
        ORDER BY (
          SELECT MAX(created_at) FROM chat_messages
          WHERE room_id = r.id
        ) DESC NULLS LAST
        LIMIT $2 OFFSET $3
      `;
      
      const result = await db.query(query, [userId, limit, offset]);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM chat_rooms r
        JOIN chat_room_members m ON r.id = m.room_id
        WHERE m.user_id = $1
      `;
      
      const countResult = await db.query(countQuery, [userId]);
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        rooms: result.rows,
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

  // Get chat room members
  static async getMembers(roomId, limit = 100, offset = 0) {
    try {
      const query = `
        SELECT 
          u.id, u.username, u.display_name, u.avatar_url,
          m.joined_at, m.last_read_at, m.role
        FROM chat_room_members m
        JOIN users u ON m.user_id = u.id
        WHERE m.room_id = $1
        ORDER BY m.role DESC, m.joined_at ASC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await db.query(query, [roomId, limit, offset]);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Add user to chat room
  static async addMember(roomId, userId, role = 'member') {
    try {
      // Check if already a member
      const checkQuery = `
        SELECT * FROM chat_room_members
        WHERE room_id = $1 AND user_id = $2
      `;
      
      const checkResult = await db.query(checkQuery, [roomId, userId]);
      
      if (checkResult.rows.length > 0) {
        return checkResult.rows[0];
      }
      
      // Add member
      const query = `
        INSERT INTO chat_room_members (room_id, user_id, role)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      
      const result = await db.query(query, [roomId, userId, role]);
      
      // Get room info
      const room = await this.findById(roomId);
      
      // Notify user about being added to the room
      socketManager.emitToUser(userId, 'chat:added_to_room', {
        roomId,
        name: room.name,
        type: room.type
      });
      
      // Notify room members about new user
      socketManager.emitToGroup(roomId, 'chat:member_joined', {
        roomId,
        userId,
        role
      });
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Remove user from chat room
  static async removeMember(roomId, userId) {
    try {
      const query = `
        DELETE FROM chat_room_members
        WHERE room_id = $1 AND user_id = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [roomId, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Notify room members about removed user
      socketManager.emitToGroup(roomId, 'chat:member_left', {
        roomId,
        userId
      });
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Update member role
  static async updateMemberRole(roomId, userId, role) {
    try {
      const query = `
        UPDATE chat_room_members
        SET role = $3
        WHERE room_id = $1 AND user_id = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [roomId, userId, role]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      // Notify room members about role change
      socketManager.emitToGroup(roomId, 'chat:member_role_changed', {
        roomId,
        userId,
        role
      });
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Mark room as read for a user
  static async markAsRead(roomId, userId) {
    try {
      const query = `
        UPDATE chat_room_members
        SET last_read_at = NOW()
        WHERE room_id = $1 AND user_id = $2
        RETURNING *
      `;
      
      const result = await db.query(query, [roomId, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get total unread messages count across all rooms
  static async getTotalUnreadCount(userId) {
    try {
      const query = `
        SELECT SUM(unread) as total_unread
        FROM (
          SELECT 
            COUNT(*) as unread
          FROM chat_messages m
          JOIN chat_room_members rm ON m.room_id = rm.room_id
          WHERE 
            rm.user_id = $1
            AND m.sender_id != $1
            AND m.created_at > COALESCE(rm.last_read_at, '1970-01-01'::timestamp)
          GROUP BY m.room_id
        ) counts
      `;
      
      const result = await db.query(query, [userId]);
      return parseInt(result.rows[0].total_unread || 0);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = ChatRoom;