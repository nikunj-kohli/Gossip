const Friendship = require('../models/Friendship');
const User = require('../models/User');

// Send friend request
const sendFriendRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const requesterId = req.user.id;
        
        // Validate target user exists
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Send friend request
        const result = await Friendship.sendRequest(requesterId, userId);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.status(201).json({
            message: result.message,
            friendship: result.friendship
        });
        
    } catch (error) {
        console.error('Error sending friend request:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Accept friend request
const acceptFriendRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const addresseeId = req.user.id;
        
        const result = await Friendship.acceptRequest(addresseeId, userId);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.json({
            message: result.message,
            friendship: result.friendship
        });
        
    } catch (error) {
        console.error('Error accepting friend request:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Decline friend request
const declineFriendRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const addresseeId = req.user.id;
        
        const result = await Friendship.declineRequest(addresseeId, userId);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.json({
            message: result.message
        });
        
    } catch (error) {
        console.error('Error declining friend request:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Cancel sent friend request
const cancelFriendRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const requesterId = req.user.id;
        
        const result = await Friendship.cancelRequest(requesterId, userId);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.json({
            message: result.message
        });
        
    } catch (error) {
        console.error('Error canceling friend request:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Remove friend
const removeFriend = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        
        const result = await Friendship.removeFriend(currentUserId, userId);
        
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }
        
        res.json({
            message: result.message
        });
        
    } catch (error) {
        console.error('Error removing friend:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get user's friends
const getFriends = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        // Validate user exists if not self
        if (userId !== req.user.id.toString()) {
            const targetUser = await User.findById(userId);
            if (!targetUser) {
                return res.status(404).json({ message: 'User not found' });
            }
        }
        
        const result = await Friendship.getFriends(userId, limit, offset);
        
        res.json(result);
        
    } catch (error) {
        console.error('Error getting friends:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get pending friend requests received
const getPendingRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const result = await Friendship.getPendingRequests(userId, limit, offset);
        
        res.json(result);
        
    } catch (error) {
        console.error('Error getting friend requests:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get sent friend requests
const getSentRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const result = await Friendship.getSentRequests(userId, limit, offset);
        
        res.json(result);
        
    } catch (error) {
        console.error('Error getting sent requests:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Check friendship status with another user
const checkFriendshipStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        
        // Validate target user exists
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const result = await Friendship.checkFriendshipStatus(currentUserId, userId);
        
        res.json(result);
        
    } catch (error) {
        console.error('Error checking friendship status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get mutual friends
const getMutualFriends = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        // Validate target user exists
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const result = await Friendship.getMutualFriends(currentUserId, userId, limit, offset);
        
        res.json(result);
        
    } catch (error) {
        console.error('Error getting mutual friends:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
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
};