const db = require('../config/database');

class Achievement {
  // Get all achievements
  static async getAll() {
    try {
      const query = `
        SELECT * FROM achievements
        ORDER BY category, required_points
      `;
      
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Get achievement by ID
  static async findById(id) {
    try {
      const query = `
        SELECT * FROM achievements
        WHERE id = $1
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

  // Get achievements by category
  static async findByCategory(category) {
    try {
      const query = `
        SELECT * FROM achievements
        WHERE category = $1
        ORDER BY required_points
      `;
      
      const result = await db.query(query, [category]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Get user's achievements
  static async getUserAchievements(userId) {
    try {
      const query = `
        SELECT 
          a.*,
          ua.earned_at,
          ua.progress
        FROM achievements a
        JOIN user_achievements ua ON a.id = ua.achievement_id
        WHERE ua.user_id = $1
        ORDER BY ua.earned_at DESC
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Get user's available achievements with progress
  static async getUserAvailableAchievements(userId) {
    try {
      const query = `
        SELECT 
          a.*,
          COALESCE(ua.progress, 0) as progress,
          CASE WHEN ua.id IS NOT NULL THEN true ELSE false END as earned
        FROM achievements a
        LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $1
        ORDER BY a.category, a.required_points
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Award achievement to user
  static async awardToUser(achievementId, userId, progress = 100) {
    try {
      // Check if already earned
      const checkQuery = `
        SELECT * FROM user_achievements
        WHERE achievement_id = $1 AND user_id = $2
      `;
      
      const checkResult = await db.query(checkQuery, [achievementId, userId]);
      
      if (checkResult.rows.length > 0) {
        // Update progress if not already at 100%
        if (checkResult.rows[0].progress < 100) {
          const updateQuery = `
            UPDATE user_achievements
            SET 
              progress = $3,
              earned_at = CASE WHEN $3 >= 100 AND progress < 100 THEN NOW() ELSE earned_at END
            WHERE achievement_id = $1 AND user_id = $2
            RETURNING *
          `;
          
          const updateResult = await db.query(updateQuery, [achievementId, userId, progress]);
          return {
            achievement: await this.findById(achievementId),
            userAchievement: updateResult.rows[0],
            isNewlyEarned: progress >= 100 && checkResult.rows[0].progress < 100
          };
        }
        
        return {
          achievement: await this.findById(achievementId),
          userAchievement: checkResult.rows[0],
          isNewlyEarned: false
        };
      }
      
      // Insert new achievement
      const insertQuery = `
        INSERT INTO user_achievements (
          achievement_id, user_id, progress, earned_at
        )
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const earnedAt = progress >= 100 ? 'NOW()' : null;
      const insertResult = await db.query(insertQuery, [achievementId, userId, progress, earnedAt]);
      
      return {
        achievement: await this.findById(achievementId),
        userAchievement: insertResult.rows[0],
        isNewlyEarned: progress >= 100
      };
    } catch (error) {
      throw error;
    }
  }

  // Update achievement progress
  static async updateProgress(achievementId, userId, progress) {
    try {
      // Check if achievement exists for user
      const checkQuery = `
        SELECT * FROM user_achievements
        WHERE achievement_id = $1 AND user_id = $2
      `;
      
      const checkResult = await db.query(checkQuery, [achievementId, userId]);
      
      if (checkResult.rows.length === 0) {
        // Create new achievement progress
        return await this.awardToUser(achievementId, userId, progress);
      }
      
      const currentProgress = checkResult.rows[0].progress;
      
      // Only update if new progress is higher
      if (progress > currentProgress) {
        const isCompleting = progress >= 100 && currentProgress < 100;
        
        const updateQuery = `
          UPDATE user_achievements
          SET 
            progress = $3,
            earned_at = CASE WHEN $3 >= 100 AND progress < 100 THEN NOW() ELSE earned_at END
          WHERE achievement_id = $1 AND user_id = $2
          RETURNING *
        `;
        
        const updateResult = await db.query(updateQuery, [achievementId, userId, progress]);
        
        return {
          achievement: await this.findById(achievementId),
          userAchievement: updateResult.rows[0],
          isNewlyEarned: isCompleting
        };
      }
      
      return {
        achievement: await this.findById(achievementId),
        userAchievement: checkResult.rows[0],
        isNewlyEarned: false
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Achievement;