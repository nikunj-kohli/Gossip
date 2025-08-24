const db = require('../config/database');
const SearchUtils = require('../utils/searchUtils');

class Search {
  // Search posts
  static async searchPosts(searchTerm, userId = null, options = {}) {
    try {
      const limit = options.limit || 20;
      const offset = options.offset || 0;
      const sort = options.sort || 'recent';
      const filters = options.filters || {};
      
      // Generate search query parts
      const { query: searchQuery, params: searchParams } = SearchUtils.generateSearchQuery(searchTerm);
      
      // Parse filters
      const { conditions: filterConditions, params: filterParams } = SearchUtils.parseFilters(filters);
      
      // Combine all conditions
      const allConditions = [];
      if (searchQuery) {
        allConditions.push(`(${searchQuery})`);
      }
      
      if (filterConditions.length > 0) {
        allConditions.push(...filterConditions);
      }
      
      // Visibility condition - user can see public posts and their own posts
      if (userId) {
        allConditions.push(`(
          visibility = 'public' 
          OR user_id = $${searchParams.length + filterParams.length + 1}
          OR (
            visibility = 'friends' 
            AND EXISTS (
              SELECT 1 FROM friendships 
              WHERE (requester_id = posts.user_id AND addressee_id = $${searchParams.length + filterParams.length + 1} OR 
                    requester_id = $${searchParams.length + filterParams.length + 1} AND addressee_id = posts.user_id) 
              AND status = 'accepted'
            )
          )
          OR (
            visibility = 'group' 
            AND EXISTS (
              SELECT 1 FROM group_members 
              WHERE group_id = posts.group_id AND user_id = $${searchParams.length + filterParams.length + 1}
            )
          )
        )`);
      } else {
        allConditions.push(`visibility = 'public'`);
      }
      
      // Add active condition
      allConditions.push(`is_active = true`);
      
      // Build WHERE clause
      const whereClause = allConditions.length > 0 
        ? `WHERE ${allConditions.join(' AND ')}` 
        : '';
      
      // Order by
      const orderBy = SearchUtils.parseSortOptions(sort);
      
      // Build final query
      const query = `
        SELECT 
          p.*,
          u.username, u.display_name, u.avatar_url,
          (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
          (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
          ${userId ? `(SELECT COUNT(*) > 0 FROM likes WHERE post_id = p.id AND user_id = $${searchParams.length + filterParams.length + 1}) AS liked_by_user` : 'false AS liked_by_user'}
        FROM 
          posts p
        JOIN 
          users u ON p.user_id = u.id
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${searchParams.length + filterParams.length + (userId ? 2 : 1)}
        OFFSET $${searchParams.length + filterParams.length + (userId ? 3 : 2)}
      `;
      
      // Combine all params
      const allParams = [
        ...searchParams,
        ...filterParams
      ];
      
      if (userId) {
        allParams.push(userId);
      }
      
      allParams.push(limit);
      allParams.push(offset);
      
      // Execute query
      const result = await db.query(query, allParams);
      
      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) 
        FROM posts p
        JOIN users u ON p.user_id = u.id
        ${whereClause}
      `;
      
      const countResult = await db.query(countQuery, allParams.slice(0, -2));
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        posts: result.rows,
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
  
  // Search users
  static async searchUsers(searchTerm, currentUserId = null, options = {}) {
    try {
      const limit = options.limit || 20;
      const offset = options.offset || 0;
      
      // Split search term into words
      const terms = searchTerm.trim().split(/\s+/).filter(term => term.length > 0);
      
      if (terms.length === 0) {
        return {
          users: [],
          pagination: {
            total: 0,
            limit,
            offset
          }
        };
      }
      
      // Generate array of LIKE conditions for each term
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      terms.forEach(term => {
        const paramValue = `%${term.toLowerCase()}%`;
        conditions.push(`(
          LOWER(username) LIKE $${paramIndex} OR 
          LOWER(display_name) LIKE $${paramIndex} OR 
          LOWER(bio) LIKE $${paramIndex}
        )`);
        params.push(paramValue);
        paramIndex++;
      });
      
      // Join conditions with OR
      const whereClause = conditions.join(' OR ');
      
      // Build query
      const query = `
        SELECT 
          u.id, u.username, u.display_name, u.bio, u.avatar_url, u.created_at,
          ${currentUserId ? `
            CASE
              WHEN f.status = 'accepted' THEN 'friends'
              WHEN f.requester_id = $${paramIndex} THEN 'pending_sent'
              WHEN f.addressee_id = $${paramIndex} THEN 'pending_received'
              ELSE 'none'
            END AS friendship_status
          ` : `'none' AS friendship_status`}
        FROM 
          users u
        ${currentUserId ? `
          LEFT JOIN (
            SELECT * FROM friendships 
            WHERE requester_id = $${paramIndex} OR addressee_id = $${paramIndex}
          ) f ON (f.requester_id = u.id OR f.addressee_id = u.id)
        ` : ''}
        WHERE 
          (${whereClause})
          AND u.is_active = true
          ${currentUserId ? `AND u.id != $${paramIndex}` : ''}
        ORDER BY 
          u.display_name ASC
        LIMIT $${paramIndex + 1}
        OFFSET $${paramIndex + 2}
      `;
      
      // Add params
      if (currentUserId) {
        params.push(currentUserId);
      }
      
      params.push(limit);
      params.push(offset);
      
      // Execute query
      const result = await db.query(query, params);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) 
        FROM users u
        WHERE (${whereClause})
        AND u.is_active = true
        ${currentUserId ? `AND u.id != $${paramIndex - 3}` : ''}
      `;
      
      const countResult = await db.query(countQuery, params.slice(0, currentUserId ? -3 : -2));
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        users: result.rows,
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
  
  // Get trending posts
  static async getTrendingPosts(userId = null, options = {}) {
    try {
      const limit = options.limit || 20;
      const offset = options.offset || 0;
      const timeframe = options.timeframe || '7days'; // 24h, 7days, 30days
      
      // Convert timeframe to hours
      let timeframeHours;
      switch (timeframe) {
        case '24h':
          timeframeHours = 24;
          break;
        case '7days':
          timeframeHours = 24 * 7;
          break;
        case '30days':
          timeframeHours = 24 * 30;
          break;
        default:
          timeframeHours = 24 * 7; // Default to 7 days
      }
      
      // Visibility condition
      const visibilityCondition = userId ? `
        (
          p.visibility = 'public' 
          OR p.user_id = $1
          OR (
            p.visibility = 'friends' 
            AND EXISTS (
              SELECT 1 FROM friendships 
              WHERE (requester_id = p.user_id AND addressee_id = $1 OR 
                    requester_id = $1 AND addressee_id = p.user_id) 
              AND status = 'accepted'
            )
          )
          OR (
            p.visibility = 'group' 
            AND EXISTS (
              SELECT 1 FROM group_members 
              WHERE group_id = p.group_id AND user_id = $1
            )
          )
        )
      ` : `p.visibility = 'public'`;
      
      // Query to get engagement metrics and calculate trending score
      const query = `
        SELECT 
          p.*,
          u.username, u.display_name, u.avatar_url,
          COALESCE(l.like_count, 0) AS like_count,
          COALESCE(c.comment_count, 0) AS comment_count,
          COALESCE(v.view_count, 0) AS view_count,
          ${userId ? `COALESCE(ul.user_liked, false) AS liked_by_user,` : `false AS liked_by_user,`}
          EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600 AS age_hours,
          (
            (COALESCE(l.like_count, 0) * 2) + 
            (COALESCE(c.comment_count, 0) * 3) + 
            (COALESCE(v.view_count, 0) * 0.2)
          ) / POWER((EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) + 2, 1.5) AS trending_score
        FROM 
          posts p
        JOIN 
          users u ON p.user_id = u.id
        LEFT JOIN (
          SELECT post_id, COUNT(*) AS like_count
          FROM likes
          GROUP BY post_id
        ) l ON p.id = l.post_id
        LEFT JOIN (
          SELECT post_id, COUNT(*) AS comment_count
          FROM comments
          GROUP BY post_id
        ) c ON p.id = c.post_id
        LEFT JOIN (
          SELECT post_id, COUNT(*) AS view_count
          FROM post_views
          GROUP BY post_id
        ) v ON p.id = v.post_id
        ${userId ? `
        LEFT JOIN (
          SELECT post_id, true AS user_liked
          FROM likes
          WHERE user_id = $1
        ) ul ON p.id = ul.post_id
        ` : ''}
        WHERE 
          p.is_active = true
          AND ${visibilityCondition}
          AND p.created_at > NOW() - INTERVAL '${timeframeHours} hours'
        ORDER BY 
          trending_score DESC
        LIMIT $${userId ? 2 : 1}
        OFFSET $${userId ? 3 : 2}
      `;
      
      // Execute query
      const params = userId ? [userId, limit, offset] : [limit, offset];
      const result = await db.query(query, params);
      
      // Get total count
      const countQuery = `
        SELECT COUNT(*) 
        FROM posts p
        WHERE 
          p.is_active = true
          AND ${visibilityCondition}
          AND p.created_at > NOW() - INTERVAL '${timeframeHours} hours'
      `;
      
      const countParams = userId ? [userId] : [];
      const countResult = await db.query(countQuery, countParams);
      const totalCount = parseInt(countResult.rows[0].count);
      
      return {
        posts: result.rows,
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
  
  // Search combined (users and posts)
  static async searchAll(searchTerm, userId = null, options = {}) {
    try {
      // Get posts and users in parallel
      const [postsResult, usersResult] = await Promise.all([
        this.searchPosts(searchTerm, userId, { ...options, limit: 10, offset: 0 }),
        this.searchUsers(searchTerm, userId, { ...options, limit: 10, offset: 0 })
      ]);
      
      return {
        posts: postsResult.posts,
        postCount: postsResult.pagination.total,
        users: usersResult.users,
        userCount: usersResult.pagination.total
      };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Search;