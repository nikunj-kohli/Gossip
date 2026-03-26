const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { cacheMiddleware, cacheBustMiddleware } = require('../middleware/cache');
const { 
    createPost, 
    getAllPosts, 
    getDiscoverPosts,
    getFeedPreferences,
    updateFeedPreferences,
    markPostNotInterested,
    getPostByPermalink,
    sharePost,
    getPostById, 
    getUserPosts,
    updatePost,
    deletePost,
    createGroupPost,
    getGroupPosts,
    warnCommunityPost
} = require('../controllers/postController');

const router = express.Router();

// Public routes (with optional auth for personalized content)
router.get('/', optionalAuth, cacheMiddleware(60), getAllPosts);
router.get('/discover', authenticateToken, getDiscoverPosts);
router.get('/preferences/feed', authenticateToken, getFeedPreferences);
router.put('/preferences/feed', authenticateToken, updateFeedPreferences);
router.get('/user/:userId', optionalAuth, getUserPosts);
router.get('/groups/:groupId/posts', optionalAuth, getGroupPosts);
router.get('/p/:headline/:dateAndToken', optionalAuth, getPostByPermalink);
router.get('/c/:communitySlug/:headline/:dateAndToken', optionalAuth, getPostByPermalink);
router.post('/:id/not-interested', authenticateToken, markPostNotInterested);
router.post('/:id/share', optionalAuth, sharePost);
router.get('/:id', optionalAuth, getPostById);

// Protected routes
router.post('/', authenticateToken, cacheBustMiddleware(['cache:/api/posts*']), createPost);
router.put('/:id', authenticateToken, cacheBustMiddleware(['cache:/api/posts*']), updatePost);
router.delete('/:id', authenticateToken, cacheBustMiddleware(['cache:/api/posts*']), deletePost);
router.post('/:id/warn', authenticateToken, warnCommunityPost);
router.get('/me/posts', authenticateToken, getUserPosts);

// Protected group post routes
router.post('/groups/:groupId/posts', authenticateToken, createGroupPost);

module.exports = router;