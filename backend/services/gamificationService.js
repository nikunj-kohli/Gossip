const Achievement = require('../models/Achievement');
const Points = require('../models/Points');
const Reputation = require('../models/Reputation');
const socketManager = require('../utils/socketManager');

class GamificationService {
  // Award points for an action
  static async awardPoints(userId, action, entityId = null, details = null) {
    try {
      // Define point values for different actions
      const pointValues = {
        post_create: 10,
        post_like_received: 2,
        comment_create: 5,
        comment_like_received: 1,
        profile_complete: 20,
        daily_login: 5,
        friend_added: 5,
        group_join: 3,
        group_create: 15,
        achievement_earned: 25
      };
      
      // Check if action is valid
      if (!pointValues[action]) {
        throw new Error(`Invalid action: ${action}`);
      }
      
      // Award points
      const result = await Points.award(
        userId,
        pointValues[action],
        action,
        entityId,
        details
      );
      
      // Check for level up
      const previousLevel = Math.floor(Math.sqrt((result.userPoints.total_points - pointValues[action]) / 100)) + 1;
      const newLevel = result.userPoints.level;
      
      if (newLevel > previousLevel) {
        // User leveled up, notify them
        socketManager.emitToUser(userId, 'gamification:level_up', {
          userId,
          previousLevel,
          newLevel,
          totalPoints: result.userPoints.total_points
        });
        
        // Emit to others who follow this user?
        // This could be implemented if you have a following system
      }
      
      // Emit points update to user
      socketManager.emitToUser(userId, 'gamification:points_earned', {
        userId,
        points: pointValues[action],
        action,
        totalPoints: result.userPoints.total_points
      });
      
      // Check for achievements related to points
      await this.checkPointsAchievements(userId, result.userPoints.total_points);
      
      // Check for activity achievements
      await this.checkActivityAchievements(userId, action);
      
      // If needed, update reputation
      if (['post_create', 'post_like_received', 'comment_create'].includes(action)) {
        await Reputation.updateReputation(userId);
      }
      
      return result;
    } catch (error) {
      console.error('Error awarding points:', error);
      throw error;
    }
  }

  // Check for points-based achievements
  static async checkPointsAchievements(userId, totalPoints) {
    try {
      // Get all point-based achievements
      const query = `
        SELECT * FROM achievements
        WHERE category = 'points'
        ORDER BY required_points
      `;
      
      const result = await db.query(query);
      const achievements = result.rows;
      
      // Check each achievement
      for (const achievement of achievements) {
        if (totalPoints >= achievement.required_points) {
          // Award the achievement
          const awarded = await Achievement.awardToUser(achievement.id, userId);
          
          // If newly earned, notify user
          if (awarded.isNewlyEarned) {
            socketManager.emitToUser(userId, 'gamification:achievement_earned', {
              userId,
              achievement: awarded.achievement
            });
            
            // Award points for earning achievement
            await this.awardPoints(
              userId,
              'achievement_earned',
              achievement.id,
              { achievementName: achievement.name }
            );
          }
        }
      }
    } catch (error) {
      console.error('Error checking points achievements:', error);
    }
  }

  // Check for activity-based achievements
  static async checkActivityAchievements(userId, action) {
    try {
      // Get action counts
      const activityCounts = await this.getUserActivityCounts(userId);
      
      // Get all relevant achievements
      const query = `
        SELECT * FROM achievements
        WHERE category = $1
        ORDER BY required_points
      `;
      
      let category;
      let count;
      
      // Map action to achievement category
      switch (action) {
        case 'post_create':
          category = 'posts';
          count = activityCounts.posts;
          break;
        case 'comment_create':
          category = 'comments';
          count = activityCounts.comments;
          break;
        case 'friend_added':
          category = 'friends';
          count = activityCounts.friends;
          break;
        case 'post_like_received':
        case 'comment_like_received':
          category = 'likes_received';
          count = activityCounts.likes_received;
          break;
        default:
          // No achievement category for this action
          return;
      }
      
      const result = await db.query(query, [category]);
      const achievements = result.rows;
      
      // Check each achievement
      for (const achievement of achievements) {
        if (count >= achievement.required_points) {
          // Award the achievement
          const awarded = await Achievement.awardToUser(achievement.id, userId);
          
          // If newly earned, notify user
          if (awarded.isNewlyEarned) {
            socketManager.emitToUser(userId, 'gamification:achievement_earned', {
              userId,
              achievement: awarded.achievement
            });
            
            // Award points for earning achievement
            await this.awardPoints(
              userId,
              'achievement_earned',
              achievement.id,
              { achievementName: achievement.name }
            );
          }
        } else {
          // Update progress
          const progress = Math.min(100, Math.floor((count / achievement.required_points) * 100));
          await Achievement.updateProgress(achievement.id, userId, progress);
        }
      }
    } catch (error) {
      console.error('Error checking activity achievements:', error);
    }
  }

  // Get user activity counts for achievements
  static async getUserActivityCounts(userId) {
    try {
      const counts = {
        posts: 0,
        comments: 0,
        likes_received: 0,
        friends: 0,
        groups: 0,
        days_active: 0
      };
      
      // Get post count
      const postsQuery = `
        SELECT COUNT(*) FROM posts
        WHERE user_id = $1
      `;
      
      const postsResult = await db.query(postsQuery, [userId]);
      counts.posts = parseInt(postsResult.rows[0].count);
      
      // Get comment count
      const commentsQuery = `
        SELECT COUNT(*) FROM comments
        WHERE user_id = $1
      `;
      
      const commentsResult = await db.query(commentsQuery, [userId]);
      counts.comments = parseInt(commentsResult.rows[0].count);
      
      // Get likes received
      const likesQuery = `
        SELECT COUNT(*) FROM likes l
        JOIN posts p ON l.post_id = p.id
        WHERE p.user_id = $1
      `;
      
      const likesResult = await db.query(likesQuery, [userId]);
      counts.likes_received = parseInt(likesResult.rows[0].count);
      
      // Get friends count
      const friendsQuery = `
        SELECT COUNT(*) FROM friendships
        WHERE (requester_id = $1 OR addressee_id = $1)
        AND status = 'accepted'
      `;
      
      const friendsResult = await db.query(friendsQuery, [userId]);
      counts.friends = parseInt(friendsResult.rows[0].count);
      
      // Get groups count
      const groupsQuery = `
        SELECT COUNT(*) FROM group_members
        WHERE user_id = $1
      `;
      
      const groupsResult = await db.query(groupsQuery, [userId]);
      counts.groups = parseInt(groupsResult.rows[0].count);
      
      // Get days active
      const daysQuery = `
        SELECT COUNT(DISTINCT DATE(created_at)) 
        FROM point_transactions
        WHERE user_id = $1 AND type = 'daily_login'
      `;
      
      const daysResult = await db.query(daysQuery, [userId]);
      counts.days_active = parseInt(daysResult.rows[0].count);
      
      return counts;
    } catch (error) {
      console.error('Error getting user activity counts:', error);
      throw error;
    }
  }

  // Record daily login
  static async recordDailyLogin(userId) {
    try {
      // Check if already logged in today
      const today = new Date().toISOString().split('T')[0];
      
      const checkQuery = `
        SELECT COUNT(*) FROM point_transactions
        WHERE user_id = $1 
        AND type = 'daily_login'
        AND DATE(created_at) = $2
      `;
      
      const checkResult = await db.query(checkQuery, [userId, today]);
      const alreadyLoggedToday = parseInt(checkResult.rows[0].count) > 0;
      
      if (alreadyLoggedToday) {
        return null;
      }
      
      // Award points for daily login
      const result = await this.awardPoints(
        userId,
        'daily_login',
        null,
        { date: today }
      );
      
      // Check for consecutive days achievement
      const consecutiveDaysQuery = `
        WITH date_series AS (
          SELECT 
            DISTINCT DATE(created_at) as login_date
          FROM point_transactions
          WHERE 
            user_id = $1 
            AND type = 'daily_login'
          ORDER BY login_date DESC
        ),
        consecutive_days AS (
          SELECT 
            login_date,
            login_date - ROW_NUMBER() OVER (ORDER BY login_date DESC)::INTEGER AS grp
          FROM date_series
        )
        SELECT COUNT(*) as streak
        FROM consecutive_days
        WHERE grp = (
          SELECT MIN(grp) FROM consecutive_days
          WHERE login_date = $2::DATE
        )
      `;
      
      const streakResult = await db.query(consecutiveDaysQuery, [userId, today]);
      const streak = parseInt(streakResult.rows[0].streak);
      
      // Check for streak achievements
      const streakAchievements = {
        3: 'streak_3days',
        7: 'streak_7days',
        30: 'streak_30days',
        90: 'streak_90days',
        365: 'streak_365days'
      };
      
      for (const [requiredDays, achievementKey] of Object.entries(streakAchievements)) {
        if (streak >= parseInt(requiredDays)) {
          // Find achievement by key
          const achievementQuery = `
            SELECT * FROM achievements
            WHERE key = $1
          `;
          
          const achievementResult = await db.query(achievementQuery, [achievementKey]);
          
          if (achievementResult.rows.length > 0) {
            const achievement = achievementResult.rows[0];
            // Award the achievement
            await Achievement.awardToUser(achievement.id, userId);
          }
        }
      }
      
      return {
        result,
        streak
      };
    } catch (error) {
      console.error('Error recording daily login:', error);
      throw error;
    }
  }
}

module.exports = GamificationService;