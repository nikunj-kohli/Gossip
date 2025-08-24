const express = require('express');
const { addComment, getComments, deleteComment } = require('../controllers/commentController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Add comment to post
router.post('/posts/:id/comments', authenticateToken, addComment);

// Get comments for a post
router.get('/posts/:id/comments', optionalAuth, getComments);

// Delete a comment
router.delete('/posts/:id/comments/:commentId', authenticateToken, deleteComment);

module.exports = router;