const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { 
    createPost, 
    getAllPosts, 
    getPostById, 
    getUserPosts,
    updatePost,
    deletePost,
    createGroupPost,
    getGroupPosts,
    togglePinPost
} = require('../controllers/postController');

const router = express.Router();

// Public routes (with optional auth for personalized content)
router.get('/', optionalAuth, getAllPosts);
router.get('/:id', optionalAuth, getPostById);
router.get('/user/:userId', optionalAuth, getUserPosts);

// Group post routes
router.get('/groups/:groupId/posts', optionalAuth, getGroupPosts);

// Protected routes
router.post('/', authenticateToken, createPost);
router.put('/:id', authenticateToken, updatePost);
router.delete('/:id', authenticateToken, deletePost);
router.get('/me/posts', authenticateToken, getUserPosts);

// Protected group post routes
router.post('/groups/:groupId/posts', authenticateToken, createGroupPost);
router.post('/groups/:groupId/posts/:postId/pin', authenticateToken, togglePinPost);

module.exports = router;