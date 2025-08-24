const db = require('../config/database');

class Points {
  // Award points to user
  static async award(userId, amount, type, entityId = null, details = null) {
    try {
      // Insert transaction
      const query = `
        INSERT INTO point_transactions (
          user_id, amount, type, entity_id, details
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      
      const values = [userId, amount, type, entityId, details];
      const result = await db.query(query, values);
      const transaction = result.rows[0];
      
      // Update user points
      const updateQuery = `
        INSERT INTO user_points (user_id, total_points, level)
        VALUES ($1, $2, FLOOR(SQRT($2 / 100)) + 1)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          total_points = user_points.total_points + $2,
          level = FLOOR(SQRT((user_points.total_points + $2) / 100)) + 1,
          updated_at = NOW()
        RETURNING *
      `;
      
      const updateResult = await db.query(updateQuery, [userId, amount]);
      const userPoints = updateResult.rows[0];
      
      return {
        transaction,
        userPoints
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user's point total and level
  static async getUserPoints(userId) {
    try {
      const query = `
        SELECT * FROM user_points
        WHERE user_id = $1
      `;
      
      const result = await db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        // Return default values if no record exists
        return {
          user_id: userId,
          total_points: 0,
          level: 1,
          created_at: new Date(),
          updated_at: new Date()
        };
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get user's point transactions
  static async getUserTransactions(userId, limit = 20, offset = 0) {
    try {
      const query = `
        SELECT * FROM point_transactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      
      const result = await db.query(query, [userId, limit, offset]);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) FROM point_transactions
        WHERE user_id = $1
      `;
      
      const countResult = await db.query(countQuery, [userId]);
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        transactions: result.rows,
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

  // Get point transaction by ID
  static async getTransactionById(transactionId) {
    try {
      const query = `
        SELECT * FROM point_transactions
        WHERE id = $1
      `;
      
      const result = await db.query(query, [transactionId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Get leaderboard
  static async getLeaderboard(period = 'all', limit = 10) {
    try {
      let query;
      let params = [limit];
      
      switch (period) {
        case 'day':
          query = `
            SELECT 
              u.id, u.username, u.display_name, u.avatar_url,
              COALESCE(SUM(pt.amount), 0) as points
            FROM users u
            LEFT JOIN point_transactions pt ON u.id = pt.user_id
              AND pt.created_at > NOW() - INTERVAL '1 day'
            WHERE u.is_active = true
            GROUP BY u.id
            ORDER BY points DESC
            LIMIT $1
          `;
          break;
          
        case 'week':
          query = `
            SELECT 
              u.id, u.username, u.display_name, u.avatar_url,
              COALESCE(SUM(pt.amount), 0) as points
            FROM users u
            LEFT JOIN point_transactions pt ON u.id = pt.user_id
              AND pt.created_at > NOW() - INTERVAL '7 days'
            WHERE u.is_active = true
            GROUP BY u.id
            ORDER BY points DESC
            LIMIT $1
          `;
          break;
          
        case 'month':
          query = `
            SELECT 
              u.id, u.username, u.display_name, u.avatar_url,
              COALESCE(SUM(pt.amount), 0) as points
            FROM users u
            LEFT JOIN point_transactions pt ON u.id = pt.user_id
              AND pt.created_at > NOW() - INTERVAL '30 days'
            WHERE u.is_active = true
            GROUP BY u.id
            ORDER BY points DESC
            LIMIT $1
          `;
          break;
          
        default:
          // All time
          query = `
            SELECT 
              u.id, u.username, u.display_name, u.avatar_url,
              COALESCE(up.total_points, 0) as points,
              COALESCE(up.level, 1) as level
            FROM users u
            LEFT JOIN user_points up ON u.id = up.user_id
            WHERE u.is_active = true
            ORDER BY points DESC
            LIMIT $1
          `;
      }
      
      const result = await db.query(query, params);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Get rank for a user
  static async getUserRank(userId, period = 'all') {
    try {
      let query;
      let params = [userId];
      
      switch (period) {
        case 'day':
          query = `
            SELECT count(*) + 1 as rank
            FROM (
              SELECT 
                u.id,
                COALESCE(SUM(pt.amount), 0) as points
              FROM users u
              LEFT JOIN point_transactions pt ON u.id = pt.user_id
                AND pt.created_at > NOW() - INTERVAL '1 day'
              WHERE u.is_active = true
              GROUP BY u.id
            ) as user_points
            WHERE points > (
              SELECT COALESCE(SUM(amount), 0)
              FROM point_transactions
              WHERE user_id = $1
                AND created_at > NOW() - INTERVAL '1 day'
            )
          `;
          break;
          
        case 'week':
          query = `
            SELECT count(*) + 1 as rank
            FROM (
              SELECT 
                u.id,
                COALESCE(SUM(pt.amount), 0) as points
              FROM users u
              LEFT JOIN point_transactions pt ON u.id = pt.user_id
                AND pt.created_at > NOW() - INTERVAL '7 days'
              WHERE u.is_active = true
              GROUP BY u.id
            ) as user_points
            WHERE points > (
              SELECT COALESCE(SUM(amount), 0)
              FROM point_transactions
              WHERE user_id = $1
                AND created_at > NOW() - INTERVAL '7 days'
            )
          `;
          break;
          
        case 'month':
          query = `
            SELECT count(*) + 1 as rank
            FROM (
              SELECT 
                u.id,
                COALESCE(SUM(pt.amount), 0) as points
              FROM users u
              LEFT JOIN point_transactions pt ON u.id = pt.user_id
                AND pt.created_at > NOW() - INTERVAL '30 days'
              WHERE u.is_active = true
              GROUP BY u.id
            ) as user_points
            WHERE points > (
              SELECT COALESCE(SUM(amount), 0)
              FROM point_transactions
              WHERE user_id = $1
                AND created_at > NOW() - INTERVAL '30 days'
            )
          `;
          break;
          
        default:
          // All time
          query = `
            SELECT count(*) + 1 as rank
            FROM (
              SELECT 
                u.id,
                COALESCE(up.total_points, 0) as points
              FROM users u
              LEFT JOIN user_points up ON u.id = up.user_id
              WHERE u.is_active = true
            ) as user_points
            WHERE points > (
              SELECT COALESCE(total_points, 0)
              FROM user_points
              WHERE user_id = $1
            )
          `;
      }
      
      const result = await db.query(query, params);
      
      return parseInt(result.rows[0].rank);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Points;