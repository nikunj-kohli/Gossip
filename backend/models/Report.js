const db = require('../config/database');

class Report {
  // Create a new report
  static async create({ reporterId, entityType, entityId, reason, details }) {
    try {
      const query = `
        INSERT INTO reports (
          reporter_id, entity_type, entity_id, reason, details, status
        )
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *
      `;
      
      const values = [reporterId, entityType, entityId, reason, details];
      const result = await db.query(query, values);
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get all reports with pagination and filters
  static async getAll(options = {}) {
    try {
      const {
        status = null,
        entityType = null,
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = options;
      
      // Build conditions
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (status) {
        conditions.push(`r.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }
      
      if (entityType) {
        conditions.push(`r.entity_type = $${paramIndex}`);
        params.push(entityType);
        paramIndex++;
      }
      
      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}` 
        : '';
      
      // Validate sort parameters
      const validSortColumns = ['created_at', 'updated_at', 'status'];
      const validSortOrders = ['ASC', 'DESC'];
      
      const orderBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const orderDirection = validSortOrders.includes(sortOrder.toUpperCase()) 
        ? sortOrder.toUpperCase() 
        : 'DESC';
      
      const query = `
        SELECT 
          r.*,
          u.username as reporter_username,
          u.display_name as reporter_display_name,
          u.avatar_url as reporter_avatar,
          CASE
            WHEN r.entity_type = 'post' THEN (
              SELECT content FROM posts WHERE id = r.entity_id
            )
            WHEN r.entity_type = 'comment' THEN (
              SELECT text FROM comments WHERE id = r.entity_id
            )
            WHEN r.entity_type = 'user' THEN (
              SELECT username FROM users WHERE id = r.entity_id
            )
            ELSE NULL
          END as entity_preview
        FROM 
          reports r
        JOIN 
          users u ON r.reporter_id = u.id
        ${whereClause}
        ORDER BY 
          r.${orderBy} ${orderDirection}
        LIMIT $${paramIndex}
        OFFSET $${paramIndex + 1}
      `;
      
      params.push(limit);
      params.push(offset);
      
      const result = await db.query(query, params);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM reports r ${whereClause}
      `;
      
      const countResult = await db.query(countQuery, params.slice(0, -2));
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        reports: result.rows,
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

  // Get report by ID
  static async findById(id) {
    try {
      const query = `
        SELECT 
          r.*,
          u.username as reporter_username,
          u.display_name as reporter_display_name,
          u.avatar_url as reporter_avatar
        FROM 
          reports r
        JOIN 
          users u ON r.reporter_id = u.id
        WHERE 
          r.id = $1
      `;
      
      const result = await db.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Update report status
  static async updateStatus(id, status, moderatorId, notes = null) {
    try {
      const query = `
        UPDATE reports
        SET 
          status = $1, 
          moderator_id = $2,
          moderator_notes = $3,
          updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;
      
      const values = [status, moderatorId, notes, id];
      const result = await db.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Report not found');
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get reports for an entity
  static async getByEntity(entityType, entityId) {
    try {
      const query = `
        SELECT 
          r.*,
          u.username as reporter_username,
          u.display_name as reporter_display_name
        FROM 
          reports r
        JOIN 
          users u ON r.reporter_id = u.id
        WHERE 
          r.entity_type = $1 AND r.entity_id = $2
        ORDER BY 
          r.created_at DESC
      `;
      
      const result = await db.query(query, [entityType, entityId]);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Get report count by status
  static async getCounts() {
    try {
      const query = `
        SELECT 
          status, COUNT(*) as count
        FROM 
          reports
        GROUP BY 
          status
      `;
      
      const result = await db.query(query);
      
      // Convert to an object
      const counts = {
        pending: 0,
        reviewed: 0,
        actioned: 0,
        dismissed: 0,
        total: 0
      };
      
      result.rows.forEach(row => {
        counts[row.status] = parseInt(row.count);
        counts.total += parseInt(row.count);
      });
      
      return counts;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Report;