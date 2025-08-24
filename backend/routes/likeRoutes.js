const express = require('express');
const { toggleLike, getLikes } = require('../controllers/likeController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Like/unlike a post
router.post('/posts/:id/like', authenticateToken, toggleLike);

// Get users who liked a post
router.get('/posts/:id/likes', optionalAuth, getLikes);

module.exports = router;