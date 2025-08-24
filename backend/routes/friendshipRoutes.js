const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const {
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    removeFriend,
    getFriends,
    getPendingRequests,
    getSentRequests,
    checkFriendshipStatus,
    getMutualFriends
} = require('../controllers/friendshipController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Friend requests
router.post('/users/:userId/request', sendFriendRequest);
router.post('/users/:userId/accept', acceptFriendRequest);
router.post('/users/:userId/decline', declineFriendRequest);
router.post('/users/:userId/cancel', cancelFriendRequest);
router.post('/users/:userId/remove', removeFriend);

// Friend lists
router.get('/friends', getFriends); // Current user's friends
router.get('/users/:userId/friends', getFriends); // Another user's friends
router.get('/requests', getPendingRequests); // Received requests
router.get('/sent', getSentRequests); // Sent requests

// Friendship status
router.get('/users/:userId/status', checkFriendshipStatus); // Check status with another user
router.get('/users/:userId/mutual', getMutualFriends); // Get mutual friends

module.exports = router;