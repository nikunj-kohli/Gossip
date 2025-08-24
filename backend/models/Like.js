const db = require('../config/database');

class Like {
    // Add like to post
    static async addLike(userId, postId) {
        try {
            // First check if already liked
            const checkQuery = 'SELECT * FROM likes WHERE user_id = $1 AND post_id = $2';
            const checkResult = await db.query(checkQuery, [userId, postId]);
            
            // If already liked, return existing like
            if (checkResult.rows.length > 0) {
                return { liked: true, like: checkResult.rows[0] };
            }
            
            // Insert new like
            const query = `
                INSERT INTO likes (user_id, post_id)
                VALUES ($1, $2)
                RETURNING id, user_id, post_id, created_at
            `;
            const result = await db.query(query, [userId, postId]);
            
            // Update post likes count
            await db.query(
                'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1',
                [postId]
            );
            
            return { liked: true, like: result.rows[0] };
        } catch (error) {
            throw error;
        }
    }

    // Remove like from post
    static async removeLike(userId, postId) {
        try {
            // Delete the like
            const query = `
                DELETE FROM likes
                WHERE user_id = $1 AND post_id = $2
                RETURNING id
            `;
            const result = await db.query(query, [userId, postId]);
            
            // If like was found and deleted
            if (result.rows.length > 0) {
                // Update post likes count
                await db.query(
                    'UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1 AND likes_count > 0',
                    [postId]
                );
                return { liked: false };
            }
            
            return { liked: false, message: 'Like not found' };
        } catch (error) {
            throw error;
        }
    }

    // Check if user liked post
    static async checkLiked(userId, postId) {
        try {
            const query = 'SELECT * FROM likes WHERE user_id = $1 AND post_id = $2';
            const result = await db.query(query, [userId, postId]);
            return result.rows.length > 0;
        } catch (error) {
            throw error;
        }
    }

    // Get likes count for post
    static async getLikesCount(postId) {
        try {
            const query = 'SELECT COUNT(*) FROM likes WHERE post_id = $1';
            const result = await db.query(query, [postId]);
            return parseInt(result.rows[0].count);
        } catch (error) {
            throw error;
        }
    }

    // Get users who liked a post
    static async getLikesByPost(postId, limit = 10) {
        try {
            const query = `
                SELECT u.id, u.username, u.display_name, l.created_at
                FROM likes l
                JOIN users u ON l.user_id = u.id
                WHERE l.post_id = $1
                ORDER BY l.created_at DESC
                LIMIT $2
            `;
            const result = await db.query(query, [postId, limit]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Like;