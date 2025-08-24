const db = require('../config/database');

class Friendship {
    // Send friend request
    static async sendRequest(requesterId, addresseeId) {
        try {
            // Check if request already exists
            const checkQuery = `
                SELECT * FROM friendships 
                WHERE (requester_id = $1 AND addressee_id = $2)
                   OR (requester_id = $2 AND addressee_id = $1)
            `;
            const checkResult = await db.query(checkQuery, [requesterId, addresseeId]);
            
            // If friendship already exists
            if (checkResult.rows.length > 0) {
                const existing = checkResult.rows[0];
                
                // If this user already sent a request that's pending
                if (existing.requester_id === parseInt(requesterId) && existing.status === 'pending') {
                    return { 
                        success: false, 
                        message: 'Friend request already sent',
                        friendship: existing
                    };
                }
                
                // If other user already sent a request that's pending
                if (existing.addressee_id === parseInt(requesterId) && existing.status === 'pending') {
                    return { 
                        success: false, 
                        message: 'This user already sent you a friend request',
                        friendship: existing
                    };
                }
                
                // If friendship was accepted
                if (existing.status === 'accepted') {
                    return { 
                        success: false, 
                        message: 'You are already friends',
                        friendship: existing
                    };
                }
                
                // If declined, allow resending
                if (existing.status === 'declined') {
                    const updateQuery = `
                        UPDATE friendships
                        SET status = 'pending', requester_id = $1, addressee_id = $2, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $3
                        RETURNING *
                    `;
                    const result = await db.query(updateQuery, [requesterId, addresseeId, existing.id]);
                    return { 
                        success: true, 
                        message: 'Friend request sent',
                        friendship: result.rows[0]
                    };
                }
            }
            
            // Create new friend request
            const insertQuery = `
                INSERT INTO friendships (requester_id, addressee_id)
                VALUES ($1, $2)
                RETURNING *
            `;
            const result = await db.query(insertQuery, [requesterId, addresseeId]);
            
            return { 
                success: true, 
                message: 'Friend request sent',
                friendship: result.rows[0]
            };
        } catch (error) {
            if (error.message.includes('Cannot create friendship with yourself')) {
                return {
                    success: false,
                    message: 'You cannot send a friend request to yourself'
                };
            }
            throw error;
        }
    }
    
    // Accept friend request
    static async acceptRequest(userId, requesterId) {
        try {
            const query = `
                UPDATE friendships
                SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
                WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
                RETURNING *
            `;
            const result = await db.query(query, [requesterId, userId]);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    message: 'Friend request not found or already processed'
                };
            }
            
            return {
                success: true,
                message: 'Friend request accepted',
                friendship: result.rows[0]
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Decline friend request
    static async declineRequest(userId, requesterId) {
        try {
            const query = `
                UPDATE friendships
                SET status = 'declined', updated_at = CURRENT_TIMESTAMP
                WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
                RETURNING *
            `;
            const result = await db.query(query, [requesterId, userId]);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    message: 'Friend request not found or already processed'
                };
            }
            
            return {
                success: true,
                message: 'Friend request declined',
                friendship: result.rows[0]
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Cancel sent friend request
    static async cancelRequest(requesterId, addresseeId) {
        try {
            const query = `
                DELETE FROM friendships
                WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
                RETURNING *
            `;
            const result = await db.query(query, [requesterId, addresseeId]);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    message: 'Friend request not found'
                };
            }
            
            return {
                success: true,
                message: 'Friend request canceled'
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Unfriend
    static async removeFriend(userId, friendId) {
        try {
            const query = `
                DELETE FROM friendships
                WHERE ((requester_id = $1 AND addressee_id = $2) OR
                      (requester_id = $2 AND addressee_id = $1)) AND
                      status = 'accepted'
                RETURNING *
            `;
            const result = await db.query(query, [userId, friendId]);
            
            if (result.rows.length === 0) {
                return {
                    success: false,
                    message: 'Friendship not found'
                };
            }
            
            return {
                success: true,
                message: 'Friend removed successfully'
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Get all friends of user
    static async getFriends(userId, limit = 20, offset = 0) {
        try {
            const query = `
                SELECT 
                    f.id as friendship_id,
                    f.created_at as friendship_created_at,
                    CASE
                        WHEN f.requester_id = $1 THEN f.addressee_id
                        ELSE f.requester_id
                    END as user_id,
                    u.username,
                    u.display_name,
                    u.bio,
                    u.avatar_url
                FROM friendships f
                JOIN users u ON (
                    CASE
                        WHEN f.requester_id = $1 THEN f.addressee_id = u.id
                        ELSE f.requester_id = u.id
                    END
                )
                WHERE (f.requester_id = $1 OR f.addressee_id = $1)
                AND f.status = 'accepted'
                ORDER BY u.display_name
                LIMIT $2 OFFSET $3
            `;
            const result = await db.query(query, [userId, limit, offset]);
            
            // Count total friends for pagination
            const countQuery = `
                SELECT COUNT(*) FROM friendships
                WHERE (requester_id = $1 OR addressee_id = $1)
                AND status = 'accepted'
            `;
            const countResult = await db.query(countQuery, [userId]);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                friends: result.rows,
                pagination: {
                    total: totalCount,
                    limit,
                    offset
                }
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Get pending friend requests received by user
    static async getPendingRequests(userId, limit = 20, offset = 0) {
        try {
            const query = `
                SELECT 
                    f.id as friendship_id,
                    f.created_at as friendship_created_at,
                    f.requester_id,
                    u.username,
                    u.display_name,
                    u.bio,
                    u.avatar_url
                FROM friendships f
                JOIN users u ON f.requester_id = u.id
                WHERE f.addressee_id = $1
                AND f.status = 'pending'
                ORDER BY f.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            const result = await db.query(query, [userId, limit, offset]);
            
            // Count total requests for pagination
            const countQuery = `
                SELECT COUNT(*) FROM friendships
                WHERE addressee_id = $1 AND status = 'pending'
            `;
            const countResult = await db.query(countQuery, [userId]);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                requests: result.rows,
                pagination: {
                    total: totalCount,
                    limit,
                    offset
                }
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Get sent friend requests by user
    static async getSentRequests(userId, limit = 20, offset = 0) {
        try {
            const query = `
                SELECT 
                    f.id as friendship_id,
                    f.created_at as friendship_created_at,
                    f.addressee_id,
                    u.username,
                    u.display_name,
                    u.bio,
                    u.avatar_url
                FROM friendships f
                JOIN users u ON f.addressee_id = u.id
                WHERE f.requester_id = $1
                AND f.status = 'pending'
                ORDER BY f.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            const result = await db.query(query, [userId, limit, offset]);
            
            // Count total sent requests for pagination
            const countQuery = `
                SELECT COUNT(*) FROM friendships
                WHERE requester_id = $1 AND status = 'pending'
            `;
            const countResult = await db.query(countQuery, [userId]);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                sent: result.rows,
                pagination: {
                    total: totalCount,
                    limit,
                    offset
                }
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Check friendship status between two users
    static async checkFriendshipStatus(userId1, userId2) {
        try {
            const query = `
                SELECT * FROM friendships
                WHERE (requester_id = $1 AND addressee_id = $2)
                   OR (requester_id = $2 AND addressee_id = $1)
            `;
            const result = await db.query(query, [userId1, userId2]);
            
            if (result.rows.length === 0) {
                return { status: 'none' };
            }
            
            const friendship = result.rows[0];
            
            // Determine direction (who requested whom)
            let direction = null;
            if (friendship.requester_id === parseInt(userId1)) {
                direction = 'sent';
            } else {
                direction = 'received';
            }
            
            return { 
                status: friendship.status,
                direction,
                friendship
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Get mutual friends between two users
    static async getMutualFriends(userId1, userId2, limit = 20, offset = 0) {
        try {
            // This query finds users who are friends with both userId1 and userId2
            const query = `
                WITH user1_friends AS (
                    SELECT
                        CASE
                            WHEN requester_id = $1 THEN addressee_id
                            ELSE requester_id
                        END as friend_id
                    FROM friendships
                    WHERE (requester_id = $1 OR addressee_id = $1)
                    AND status = 'accepted'
                ),
                user2_friends AS (
                    SELECT
                        CASE
                            WHEN requester_id = $2 THEN addressee_id
                            ELSE requester_id
                        END as friend_id
                    FROM friendships
                    WHERE (requester_id = $2 OR addressee_id = $2)
                    AND status = 'accepted'
                )
                SELECT 
                    u.id, 
                    u.username, 
                    u.display_name,
                    u.bio,
                    u.avatar_url
                FROM user1_friends f1
                JOIN user2_friends f2 ON f1.friend_id = f2.friend_id
                JOIN users u ON u.id = f1.friend_id
                ORDER BY u.display_name
                LIMIT $3 OFFSET $4
            `;
            
            const result = await db.query(query, [userId1, userId2, limit, offset]);
            
            // Count total mutual friends
            const countQuery = `
                WITH user1_friends AS (
                    SELECT
                        CASE
                            WHEN requester_id = $1 THEN addressee_id
                            ELSE requester_id
                        END as friend_id
                    FROM friendships
                    WHERE (requester_id = $1 OR addressee_id = $1)
                    AND status = 'accepted'
                ),
                user2_friends AS (
                    SELECT
                        CASE
                            WHEN requester_id = $2 THEN addressee_id
                            ELSE requester_id
                        END as friend_id
                    FROM friendships
                    WHERE (requester_id = $2 OR addressee_id = $2)
                    AND status = 'accepted'
                )
                SELECT COUNT(*)
                FROM user1_friends f1
                JOIN user2_friends f2 ON f1.friend_id = f2.friend_id
            `;
            
            const countResult = await db.query(countQuery, [userId1, userId2]);
            const totalCount = parseInt(countResult.rows[0].count);
            
            return {
                mutualFriends: result.rows,
                pagination: {
                    total: totalCount,
                    limit,
                    offset
                }
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Friendship;