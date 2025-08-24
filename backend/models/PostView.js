const db = require('../config/database');

class PostView {
  // Record a view
  static async recordView(postId, options = {}) {
    try {
      const { userId, ipAddress, userAgent } = options;
      
      // If no user ID or IP, we can't track the view
      if (!userId && !ipAddress) {
        return null;
      }
      
      // Check if this view already exists today
      let checkQuery;
      let checkParams;
      
      if (userId) {
        checkQuery = `
          SELECT id FROM post_views 
          WHERE post_id = $1 AND user_id = $2 
          AND viewed_at::date = CURRENT_DATE
        `;
        checkParams = [postId, userId];
      } else {
        checkQuery = `
          SELECT id FROM post_views 
          WHERE post_id = $1 AND ip_address = $2 
          AND viewed_at::date = CURRENT_DATE
        `;
        checkParams = [postId, ipAddress];
      }
      
      const existingView = await db.query(checkQuery, checkParams);
      
      if (existingView.rows.length > 0) {
        // Already viewed today, don't record again
        return existingView.rows[0];
      }
      
      // Insert new view
      const query = `
        INSERT INTO post_views (post_id, user_id, ip_address, user_agent)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      
      const params = [postId, userId || null, ipAddress || null, userAgent || null];
      
      const result = await db.query(query, params);
      return result.rows[0];
    } catch (error) {
      console.error('Error recording post view:', error);
      // Don't throw - view tracking should not break the app
      return null;
    }
  }
  
  // Get view count for a post
  static async getViewCount(postId) {
    try {
      const query = `
        SELECT COUNT(DISTINCT COALESCE(user_id::text, ip_address)) AS view_count
        FROM post_views
        WHERE post_id = $1
      `;
      
      const result = await db.query(query, [postId]);
      return parseInt(result.rows[0].view_count);
    } catch (error) {
      console.error('Error getting view count:', error);
      return 0;
    }
  }
}

module.exports = PostView;