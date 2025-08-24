const db = require('../config/database');

class Moderation {
  // Take action on a post
  static async moderatePost(postId, moderatorId, action, reason = null) {
    try {
      await db.query('BEGIN');
      
      // Update post status based on action
      let postQuery;
      let postValues;
      
      switch (action) {
        case 'hide':
          postQuery = `
            UPDATE posts
            SET is_active = false, moderation_status = 'hidden'
            WHERE id = $1
            RETURNING id
          `;
          postValues = [postId];
          break;
        
        case 'restore':
          postQuery = `
            UPDATE posts
            SET is_active = true, moderation_status = 'approved'
            WHERE id = $1
            RETURNING id
          `;
          postValues = [postId];
          break;
        
        case 'flag':
          postQuery = `
            UPDATE posts
            SET moderation_status = 'flagged'
            WHERE id = $1
            RETURNING id
          `;
          postValues = [postId];
          break;
          
        case 'approve':
          postQuery = `
            UPDATE posts
            SET moderation_status = 'approved'
            WHERE id = $1
            RETURNING id
          `;
          postValues = [postId];
          break;
          
        default:
          throw new Error('Invalid moderation action');
      }
      
      const postResult = await db.query(postQuery, postValues);
      
      if (postResult.rows.length === 0) {
        await db.query('ROLLBACK');
        throw new Error('Post not found');
      }
      
      // Record the moderation action
      const actionQuery = `
        INSERT INTO moderation_actions (
          moderator_id, entity_type, entity_id, action, reason
        )
        VALUES ($1, 'post', $2, $3, $4)
        RETURNING *
      `;
      
      const actionValues = [moderatorId, postId, action, reason];
      const actionResult = await db.query(actionQuery, actionValues);
      
      // Update any pending reports for this post
      const reportsQuery = `
        UPDATE reports
        SET 
          status = 'actioned', 
          moderator_id = $1,
          updated_at = NOW()
        WHERE 
          entity_type = 'post' 
          AND entity_id = $2
          AND status = 'pending'
        RETURNING id
      `;
      
      await db.query(reportsQuery, [moderatorId, postId]);
      
      await db.query('COMMIT');
      
      return actionResult.rows[0];
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  // Take action on a comment
  static async moderateComment(commentId, moderatorId, action, reason = null) {
    try {
      await db.query('BEGIN');
      
      // Update comment status based on action
      let commentQuery;
      let commentValues;
      
      switch (action) {
        case 'hide':
          commentQuery = `
            UPDATE comments
            SET is_active = false, moderation_status = 'hidden'
            WHERE id = $1
            RETURNING id
          `;
          commentValues = [commentId];
          break;
        
        case 'restore':
          commentQuery = `
            UPDATE comments
            SET is_active = true, moderation_status = 'approved'
            WHERE id = $1
            RETURNING id
          `;
          commentValues = [commentId];
          break;
        
        case 'flag':
          commentQuery = `
            UPDATE comments
            SET moderation_status = 'flagged'
            WHERE id = $1
            RETURNING id
          `;
          commentValues = [commentId];
          break;
          
        case 'approve':
          commentQuery = `
            UPDATE comments
            SET moderation_status = 'approved'
            WHERE id = $1
            RETURNING id
          `;
          commentValues = [commentId];
          break;
          
        default:
          throw new Error('Invalid moderation action');
      }
      
      const commentResult = await db.query(commentQuery, commentValues);
      
      if (commentResult.rows.length === 0) {
        await db.query('ROLLBACK');
        throw new Error('Comment not found');
      }
      
      // Record the moderation action
      const actionQuery = `
        INSERT INTO moderation_actions (
          moderator_id, entity_type, entity_id, action, reason
        )
        VALUES ($1, 'comment', $2, $3, $4)
        RETURNING *
      `;
      
      const actionValues = [moderatorId, commentId, action, reason];
      const actionResult = await db.query(actionQuery, actionValues);
      
      // Update any pending reports for this comment
      const reportsQuery = `
        UPDATE reports
        SET 
          status = 'actioned', 
          moderator_id = $1,
          updated_at = NOW()
        WHERE 
          entity_type = 'comment' 
          AND entity_id = $2
          AND status = 'pending'
        RETURNING id
      `;
      
      await db.query(reportsQuery, [moderatorId, commentId]);
      
      await db.query('COMMIT');
      
      return actionResult.rows[0];
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  // Take action on a user
  static async moderateUser(targetUserId, moderatorId, action, reason = null, duration = null) {
    try {
      await db.query('BEGIN');
      
      // Update user status based on action
      let userQuery;
      let userValues;
      
      switch (action) {
        case 'suspend':
          userQuery = `
            UPDATE users
            SET 
              is_active = false, 
              moderation_status = 'suspended',
              suspension_end_date = ${duration ? 'NOW() + $3::INTERVAL' : 'NULL'}
            WHERE id = $1
            RETURNING id
          `;
          userValues = duration 
            ? [targetUserId, moderatorId, `${duration} days`]
            : [targetUserId, moderatorId];
          break;
        
        case 'unsuspend':
          userQuery = `
            UPDATE users
            SET 
              is_active = true, 
              moderation_status = 'active',
              suspension_end_date = NULL
            WHERE id = $1
            RETURNING id
          `;
          userValues = [targetUserId, moderatorId];
          break;
        
        case 'warn':
          userQuery = `
            UPDATE users
            SET 
              moderation_status = 'warned',
              warning_count = warning_count + 1
            WHERE id = $1
            RETURNING id
          `;
          userValues = [targetUserId, moderatorId];
          break;
          
        default:
          throw new Error('Invalid moderation action');
      }
      
      const userResult = await db.query(userQuery, userValues);
      
      if (userResult.rows.length === 0) {
        await db.query('ROLLBACK');
        throw new Error('User not found');
      }
      
      // Record the moderation action
      const actionQuery = `
        INSERT INTO moderation_actions (
          moderator_id, entity_type, entity_id, action, reason, duration
        )
        VALUES ($1, 'user', $2, $3, $4, $5)
        RETURNING *
      `;
      
      const actionValues = [moderatorId, targetUserId, action, reason, duration];
      const actionResult = await db.query(actionQuery, actionValues);
      
      // Update any pending reports for this user
      const reportsQuery = `
        UPDATE reports
        SET 
          status = 'actioned', 
          moderator_id = $1,
          updated_at = NOW()
        WHERE 
          entity_type = 'user' 
          AND entity_id = $2
          AND status = 'pending'
        RETURNING id
      `;
      
      await db.query(reportsQuery, [moderatorId, targetUserId]);
      
      await db.query('COMMIT');
      
      return actionResult.rows[0];
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  // Get moderation actions with filters
  static async getActions(options = {}) {
    try {
      const {
        entityType = null,
        entityId = null,
        moderatorId = null,
        action = null,
        limit = 20,
        offset = 0
      } = options;
      
      // Build conditions
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (entityType) {
        conditions.push(`ma.entity_type = $${paramIndex}`);
        params.push(entityType);
        paramIndex++;
      }
      
      if (entityId) {
        conditions.push(`ma.entity_id = $${paramIndex}`);
        params.push(entityId);
        paramIndex++;
      }
      
      if (moderatorId) {
        conditions.push(`ma.moderator_id = $${paramIndex}`);
        params.push(moderatorId);
        paramIndex++;
      }
      
      if (action) {
        conditions.push(`ma.action = $${paramIndex}`);
        params.push(action);
        paramIndex++;
      }
      
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      const query = `
        SELECT 
          ma.*,
          u.username as moderator_username,
          u.display_name as moderator_display_name
        FROM 
          moderation_actions ma
        JOIN 
          users u ON ma.moderator_id = u.id
        ${whereClause}
        ORDER BY 
          ma.created_at DESC
        LIMIT $${paramIndex}
        OFFSET $${paramIndex + 1}
      `;
      
      params.push(limit);
      params.push(offset);
      
      const result = await db.query(query, params);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM moderation_actions ma ${whereClause}
      `;
      
      const countResult = await db.query(countQuery, params.slice(0, -2));
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        actions: result.rows,
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

  // Get moderation stats
  static async getStats() {
    try {
      const query = `
        SELECT
          (SELECT COUNT(*) FROM reports WHERE status = 'pending') as pending_reports,
          (SELECT COUNT(*) FROM reports) as total_reports,
          (SELECT COUNT(*) FROM moderation_actions WHERE created_at > NOW() - INTERVAL '30 days') as actions_last_30days,
          (SELECT COUNT(*) FROM posts WHERE moderation_status = 'flagged') as flagged_posts,
          (SELECT COUNT(*) FROM comments WHERE moderation_status = 'flagged') as flagged_comments,
          (SELECT COUNT(*) FROM users WHERE moderation_status = 'suspended') as suspended_users
      `;
      
      const result = await db.query(query);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Moderation;