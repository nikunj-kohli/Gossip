const db = require('../config/database');

class Reputation {
  // Calculate and update user reputation
  static async updateReputation(userId) {
    try {
      // Start transaction
      await db.query('BEGIN');
      
      // Get reputation components
      const likesFactor = 2;      // Likes received
      const commentsFactor = 1;   // Comments received
      const postsFactor = 5;      // Posts created
      const flagsFactor = -10;    // Content flags
      const ageFactor = 0.1;      // Account age in days
      
      // Get likes received
      const likesQuery = `
        SELECT COUNT(*) FROM likes l
        JOIN posts p ON l.post_id = p.id
        WHERE p.user_id = $1
      `;
      
      const likesResult = await db.query(likesQuery, [userId]);
      const likesCount = parseInt(likesResult.rows[0].count);
      
      // Get comments received
      const commentsQuery = `
        SELECT COUNT(*) FROM comments c
        JOIN posts p ON c.post_id = p.id
        WHERE p.user_id = $1
      `;
      
      const commentsResult = await db.query(commentsQuery, [userId]);
      const commentsCount = parseInt(commentsResult.rows[0].count);
      
      // Get posts created
      const postsQuery = `
        SELECT COUNT(*) FROM posts
        WHERE user_id = $1
      `;
      
      const postsResult = await db.query(postsQuery, [userId]);
      const postsCount = parseInt(postsResult.rows[0].count);
      
      // Get content flags
      const flagsQuery = `
        SELECT COUNT(*) FROM reports
        WHERE entity_type IN ('post', 'comment')
        AND entity_id IN (
          SELECT id FROM posts WHERE user_id = $1
          UNION
          SELECT id FROM comments WHERE user_id = $1
        )
        AND status IN ('actioned')
      `;
      
      const flagsResult = await db.query(flagsQuery, [userId]);
      const flagsCount = parseInt(flagsResult.rows[0].count);
      
      // Get account age in days
      const ageQuery = `
        SELECT 
          EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400 as age_days
        FROM users
        WHERE id = $1
      `;
      
      const ageResult = await db.query(ageQuery, [userId]);
      const ageDays = parseFloat(ageResult.rows[0].age_days);
      
      // Calculate reputation score
      // Base formula: (likes * likesFactor + comments * commentsFactor + posts * postsFactor + age * ageFactor) - (flags * flagsFactor)
      const reputationScore = Math.max(0, Math.round(
        (likesCount * likesFactor) +
        (commentsCount * commentsFactor) +
        (postsCount * postsFactor) +
        (ageDays * ageFactor) -
        (flagsCount * Math.abs(flagsFactor))
      ));
      
      // Calculate reputation level
      // Level formula: 1 + floor(sqrt(score / 100))
      const reputationLevel = 1 + Math.floor(Math.sqrt(reputationScore / 100));
      
      // Update reputation in database
      const updateQuery = `
        INSERT INTO user_reputation (
          user_id, reputation_score, reputation_level, components
        )
        VALUES (
          $1, $2, $3, $4
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
          reputation_score = $2,
          reputation_level = $3,
          components = $4,
          updated_at = NOW()
        RETURNING *
      `;
      
      const components = {
        likes: likesCount,
        comments: commentsCount,
        posts: postsCount,
        flags: flagsCount,
        age_days: ageDays
      };
      
      const updateResult = await db.query(updateQuery, [
        userId, 
        reputationScore, 
        reputationLevel, 
        JSON.stringify(components)
      ]);
      
      await db.query('COMMIT');
      
      return updateResult.rows[0];
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  }

  // Get user reputation
  static async getUserReputation(userId) {
    try {
      const query = `
        SELECT * FROM user_reputation
        WHERE user_id = $1
      `;
      
      const result = await db.query(query, [userId]);
      
      if (result.rows.length === 0) {
        // Calculate and return if not found
        return await this.updateReputation(userId);
      }
      
      // Parse components
      const reputation = result.rows[0];
      reputation.components = typeof reputation.components === 'string'
        ? JSON.parse(reputation.components)
        : reputation.components;
      
      return reputation;
    } catch (error) {
      throw error;
    }
  }

  // Get reputation leaderboard
  static async getLeaderboard(limit = 10) {
    try {
      const query = `
        SELECT 
          u.id, u.username, u.display_name, u.avatar_url,
          r.reputation_score, r.reputation_level
        FROM user_reputation r
        JOIN users u ON r.user_id = u.id
        WHERE u.is_active = true
        ORDER BY r.reputation_score DESC
        LIMIT $1
      `;
      
      const result = await db.query(query, [limit]);
      
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Get user rank by reputation
  static async getUserRank(userId) {
    try {
      const query = `
        SELECT count(*) + 1 as rank
        FROM user_reputation
        WHERE reputation_score > (
          SELECT reputation_score FROM user_reputation
          WHERE user_id = $1
        )
      `;
      
      const result = await db.query(query, [userId]);
      
      return parseInt(result.rows[0].rank);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Reputation;