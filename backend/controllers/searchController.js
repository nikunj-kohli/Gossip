const Search = require('../models/Search');

// Search posts
exports.searchPosts = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user ? req.user.id : null;
    
    // Parse options from query params
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const sort = req.query.sort || 'recent';
    
    // Parse filters
    const filters = {};
    
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    if (req.query.userId) filters.userId = req.query.userId;
    if (req.query.groupId) filters.groupId = req.query.groupId;
    if (req.query.contentType) filters.contentType = req.query.contentType;
    if (req.query.hasMedia === 'true') filters.hasMedia = true;
    if (req.query.minLikes) filters.minLikes = parseInt(req.query.minLikes);
    
    // Handle empty search
    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const result = await Search.searchPosts(q, userId, { limit, offset, sort, filters });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error searching posts:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Search users
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user ? req.user.id : null;
    
    // Parse options
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    // Handle empty search
    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const result = await Search.searchUsers(q, userId, { limit, offset });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error searching users:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get trending posts
exports.getTrendingPosts = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    
    // Parse options
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    const timeframe = req.query.timeframe || '7days'; // 24h, 7days, 30days
    
    const result = await Search.getTrendingPosts(userId, { limit, offset, timeframe });
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting trending posts:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Search all (combined users and posts)
exports.searchAll = async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.user ? req.user.id : null;
    
    // Handle empty search
    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const result = await Search.searchAll(q, userId);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error searching:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};