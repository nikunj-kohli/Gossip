const Friendship = require('../models/Friendship');
const User = require('../models/User');
const redis = require('../services/enhancedRedisService');

const requestsCacheKey = {
    connections: (userId) => `requests:connections:user:${userId}`,
    incoming: (userId) => `requests:incoming:user:${userId}`,
    outgoing: (userId) => `requests:outgoing:user:${userId}`,
    status: (currentUserId, targetUserId) => `requests:status:${currentUserId}:${targetUserId}`
};

const invalidateUsersRequestsCache = async (userIds = []) => {
    const uniqueIds = [...new Set(userIds.map((id) => parseInt(id, 10)).filter(Boolean))];
    await Promise.all(uniqueIds.flatMap((id) => ([
        redis.del(requestsCacheKey.connections(id)),
        redis.del(requestsCacheKey.incoming(id)),
        redis.del(requestsCacheKey.outgoing(id))
    ])));
};

const resolveTargetUser = async (req) => {
    const { userId, username } = req.params;

    if (userId) {
        return User.findById(userId);
    }

    if (username) {
        return User.findByUsername(username);
    }

    return null;
};

const checkFriendshipStatus = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const targetUser = await resolveTargetUser(req);

        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const cachedStatus = await redis.get(requestsCacheKey.status(currentUserId, targetUser.id));
        if (cachedStatus) {
            return res.json(cachedStatus);
        }

        const statusResult = await Friendship.checkFriendshipStatus(currentUserId, targetUser.id);
        const status = statusResult?.status || 'none';
        const canMessage = status === 'accepted';

        await redis.set(
            requestsCacheKey.status(currentUserId, targetUser.id),
            {
                status,
                canMessage,
                isFriend: canMessage,
                direction: statusResult?.direction || null,
                friendship: statusResult?.friendship || null,
                user: {
                    id: targetUser.id,
                    username: targetUser.username,
                    display_name: targetUser.display_name,
                    avatar_url: targetUser.avatar_url || null
                }
            },
            45
        );

        return res.json({
            status,
            canMessage,
            isFriend: canMessage,
            direction: statusResult?.direction || null,
            friendship: statusResult?.friendship || null,
            user: {
                id: targetUser.id,
                username: targetUser.username,
                display_name: targetUser.display_name,
                avatar_url: targetUser.avatar_url || null
            }
        });
    } catch (error) {
        console.error('Error checking messaging access status:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const sendFriendRequest = async (req, res) => {
    try {
        const requesterId = req.user.id;
        const { userId } = req.params;

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const result = await Friendship.sendRequest(requesterId, userId);
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }

        await invalidateUsersRequestsCache([requesterId, userId]);
        await Promise.all([
            redis.del(requestsCacheKey.status(requesterId, userId)),
            redis.del(requestsCacheKey.status(userId, requesterId))
        ]);

        return res.status(201).json({
            message: 'Message request sent',
            request: result.friendship
        });
    } catch (error) {
        console.error('Error sending message request:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const acceptFriendRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const addresseeId = req.user.id;

        const result = await Friendship.acceptRequest(addresseeId, userId);
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }

        await invalidateUsersRequestsCache([addresseeId, userId]);
        await Promise.all([
            redis.del(requestsCacheKey.status(addresseeId, userId)),
            redis.del(requestsCacheKey.status(userId, addresseeId))
        ]);

        return res.json({
            message: 'Message request accepted',
            request: result.friendship
        });
    } catch (error) {
        console.error('Error accepting message request:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const declineFriendRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const addresseeId = req.user.id;

        const result = await Friendship.declineRequest(addresseeId, userId);
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }

        await invalidateUsersRequestsCache([addresseeId, userId]);
        await Promise.all([
            redis.del(requestsCacheKey.status(addresseeId, userId)),
            redis.del(requestsCacheKey.status(userId, addresseeId))
        ]);

        return res.json({ message: 'Message request declined' });
    } catch (error) {
        console.error('Error declining message request:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const cancelFriendRequest = async (req, res) => {
    try {
        const { userId } = req.params;
        const requesterId = req.user.id;

        const result = await Friendship.cancelRequest(requesterId, userId);
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }

        await invalidateUsersRequestsCache([requesterId, userId]);
        await Promise.all([
            redis.del(requestsCacheKey.status(requesterId, userId)),
            redis.del(requestsCacheKey.status(userId, requesterId))
        ]);

        return res.json({ message: 'Message request cancelled' });
    } catch (error) {
        console.error('Error canceling message request:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const removeFriend = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;

        const result = await Friendship.removeFriend(currentUserId, userId);
        if (!result.success) {
            return res.status(400).json({ message: result.message });
        }

        await invalidateUsersRequestsCache([currentUserId, userId]);
        await Promise.all([
            redis.del(requestsCacheKey.status(currentUserId, userId)),
            redis.del(requestsCacheKey.status(userId, currentUserId))
        ]);

        return res.json({ message: 'Connection removed successfully' });
    } catch (error) {
        console.error('Error removing connection:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

const getFriends = async (req, res) => {
    try {
        const userId = req.params.userId || req.user.id;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = parseInt(req.query.offset, 10) || 0;

        if (limit === 20 && offset === 0) {
            const cached = await redis.get(requestsCacheKey.connections(userId));
            if (cached) {
                return res.json(cached);
            }
        }

        if (String(userId) !== String(req.user.id)) {
            const targetUser = await User.findById(userId);
            if (!targetUser) {
                return res.status(404).json({ message: 'User not found' });
            }
        }

        const result = await Friendship.getFriends(userId, limit, offset);
        const rows = result.friends || [];

        if (limit === 20 && offset === 0) {
            await redis.set(requestsCacheKey.connections(userId), rows, 60);
        }

        return res.json(rows);
    } catch (error) {
        console.error('Error getting accepted connections:', error);
        return res.status(500).json([]);
    }
};

const getPendingRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = parseInt(req.query.offset, 10) || 0;

        if (limit === 20 && offset === 0) {
            const cached = await redis.get(requestsCacheKey.incoming(userId));
            if (cached) {
                return res.json(cached);
            }
        }

        const result = await Friendship.getPendingRequests(userId, limit, offset);
        const rows = result.requests || [];

        if (limit === 20 && offset === 0) {
            await redis.set(requestsCacheKey.incoming(userId), rows, 60);
        }

        return res.json(rows);
    } catch (error) {
        console.error('Error getting incoming message requests:', error);
        return res.status(500).json([]);
    }
};

const getSentRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = parseInt(req.query.offset, 10) || 0;

        if (limit === 20 && offset === 0) {
            const cached = await redis.get(requestsCacheKey.outgoing(userId));
            if (cached) {
                return res.json(cached);
            }
        }

        const result = await Friendship.getSentRequests(userId, limit, offset);
        const rows = result.sent || [];

        if (limit === 20 && offset === 0) {
            await redis.set(requestsCacheKey.outgoing(userId), rows, 60);
        }

        return res.json(rows);
    } catch (error) {
        console.error('Error getting outgoing message requests:', error);
        return res.status(500).json([]);
    }
};

const getMutualFriends = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = parseInt(req.query.offset, 10) || 0;

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        const result = await Friendship.getMutualFriends(currentUserId, userId, limit, offset);
        return res.json(result);
    } catch (error) {
        console.error('Error getting mutual connections:', error);
        return res.status(500).json({ message: 'Internal server error' });
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