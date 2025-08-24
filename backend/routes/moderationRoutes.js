const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { isAdminOrModerator } = require('../middleware/adminAuth');
const moderationController = require('../controllers/moderationController');

const router = express.Router();

// All routes require admin/moderator privileges
router.use(authenticateToken);
router.use(isAdminOrModerator);

// Post moderation
router.post('/posts/:postId', moderationController.moderatePost);

// Comment moderation
router.post('/comments/:commentId', moderationController.moderateComment);

// User moderation
router.post('/users/:userId', moderationController.moderateUser);

// Get moderation actions
router.get('/actions', moderationController.getModerationActions);

// Get moderation stats
router.get('/stats', moderationController.getModerationStats);

module.exports = router;