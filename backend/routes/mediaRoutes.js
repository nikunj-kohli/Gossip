const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const mediaController = require('../controllers/mediaController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Upload media
router.post('/', mediaController.uploadMiddleware, mediaController.uploadMedia);

// Get user's media
router.get('/', mediaController.getUserMedia);

// Get media by ID
router.get('/:mediaId', mediaController.getMediaById);

// Delete media
router.delete('/:mediaId', mediaController.deleteMedia);

// Post media associations
router.post('/posts/:postId/media/:mediaId', mediaController.attachMediaToPost);
router.delete('/posts/:postId/media/:mediaId', mediaController.removeMediaFromPost);
router.get('/posts/:postId/media', mediaController.getPostMedia);

module.exports = router;