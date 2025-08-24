const db = require('../config/database');

class SearchUtils {
  // Generate search query parts
  static generateSearchQuery(searchTerm) {
    // Split search term into words
    const terms = searchTerm.trim().split(/\s+/).filter(term => term.length > 0);
    
    if (terms.length === 0) {
      return { query: '', params: [] };
    }
    
    // Generate array of LIKE conditions for each term
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    
    terms.forEach(term => {
      const paramValue = `%${term.toLowerCase()}%`;
      conditions.push(`(LOWER(content) LIKE $${paramIndex})`);
      params.push(paramValue);
      paramIndex++;
    });
    
    // Join conditions with OR
    const query = conditions.join(' OR ');
    
    return { query, params };
  }
  
  // Calculate trending score
  static calculateTrendingScore(likes, comments, views, ageHours) {
    // Base formula: (likes * 2 + comments * 3 + views * 0.2) / (ageHours + 2)^1.5
    // This gives weight to engagement but decreases with time
    const engagement = (likes * 2) + (comments * 3) + (views * 0.2);
    const timeDecay = Math.pow(ageHours + 2, 1.5);
    
    return engagement / timeDecay;
  }
  
  // Parse search filters
  static parseFilters(filters = {}) {
    const validFilters = {};
    const params = [];
    const conditions = [];
    let paramIndex = 1;
    
    // Date range filter
    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(new Date(filters.startDate));
      paramIndex++;
    }
    
    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(new Date(filters.endDate));
      paramIndex++;
    }
    
    // User filter
    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex}`);
      params.push(filters.userId);
      paramIndex++;
    }
    
    // Group filter
    if (filters.groupId) {
      conditions.push(`group_id = $${paramIndex}`);
      params.push(filters.groupId);
      paramIndex++;
    }
    
    // Content type filter
    if (filters.contentType && ['text', 'media', 'link'].includes(filters.contentType)) {
      conditions.push(`post_type = $${paramIndex}`);
      params.push(filters.contentType);
      paramIndex++;
    }
    
    // Has media filter
    if (filters.hasMedia === true) {
      conditions.push(`EXISTS (SELECT 1 FROM post_media WHERE post_id = posts.id)`);
    }
    
    // Minimum likes filter
    if (filters.minLikes && !isNaN(filters.minLikes)) {
      conditions.push(`(SELECT COUNT(*) FROM likes WHERE post_id = posts.id) >= $${paramIndex}`);
      params.push(parseInt(filters.minLikes));
      paramIndex++;
    }
    
    return { conditions, params };
  }
  
  // Parse sort options
  static parseSortOptions(sort = 'recent') {
    let orderBy = '';
    
    switch (sort) {
      case 'recent':
        orderBy = 'created_at DESC';
        break;
      case 'oldest':
        orderBy = 'created_at ASC';
        break;
      case 'popular':
        orderBy = '(SELECT COUNT(*) FROM likes WHERE post_id = posts.id) DESC, created_at DESC';
        break;
      case 'commented':
        orderBy = '(SELECT COUNT(*) FROM comments WHERE post_id = posts.id) DESC, created_at DESC';
        break;
      default:
        orderBy = 'created_at DESC';
    }
    
    return orderBy;
  }
}

module.exports = SearchUtils;