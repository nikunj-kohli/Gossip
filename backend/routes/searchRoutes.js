const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const searchController = require('../controllers/searchController');

const router = express.Router();

// Public search routes without authentication for basic user search
router.get('/users', searchController.searchUsers);
router.get('/all', optionalAuth, searchController.searchAll);
router.get('/trending', optionalAuth, searchController.getTrendingPosts);

module.exports = router;