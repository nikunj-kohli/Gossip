const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const searchController = require('../controllers/searchController');

const router = express.Router();

// Public search routes with optional authentication
router.get('/posts', optionalAuth, searchController.searchPosts);
router.get('/users', optionalAuth, searchController.searchUsers);
router.get('/all', optionalAuth, searchController.searchAll);
router.get('/trending', optionalAuth, searchController.getTrendingPosts);

module.exports = router;