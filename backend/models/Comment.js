const db = require('../config/database');

class Comment {
    // Add comment to post
    static async addComment(userId, postId, content, isAnonymous = false) {
        try {
            const query = `
                INSERT INTO comments (user_id, post_id, content, is_anonymous)
                VALUES ($1, $2, $3, $4)
                RETURNING id, user_id, post_id, content, is_anonymous, created_at
            `;
            const result = await db.query(query, [userId, postId, content, isAnonymous]);
            
            // Update post comments count
            await db.query(
                'UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1',
                [postId]
            );
            
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    // Get comments for a post
    static async getCommentsByPost(postId, limit = 20, offset = 0) {
        try {
            const query = `
                SELECT 
                    c.id, 
                    c.content, 
                    c.is_anonymous, 
                    c.created_at,
                    CASE 
                        WHEN c.is_anonymous = true THEN 'Anonymous'
                        ELSE u.display_name || ' (@' || u.username || ')'
                    END as author
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.post_id = $1
                ORDER BY c.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            const result = await db.query(query, [postId, limit, offset]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    // Delete comment
    static async deleteComment(commentId, userId) {
        try {
            // First get the comment to check if user is authorized to delete
            const getQuery = `
                SELECT post_id, user_id FROM comments WHERE id = $1
            `;
            const comment = await db.query(getQuery, [commentId]);
            
            if (comment.rows.length === 0) {
                return { success: false, message: 'Comment not found' };
            }
            
            // Check if user is authorized (is the comment author)
            if (comment.rows[0].user_id !== userId) {
                return { success: false, message: 'Not authorized to delete this comment' };
            }
            
            const postId = comment.rows[0].post_id;
            
            // Delete the comment
            const deleteQuery = `
                DELETE FROM comments WHERE id = $1
            `;
            await db.query(deleteQuery, [commentId]);
            
            // Update post comments count
            await db.query(
                'UPDATE posts SET comments_count = comments_count - 1 WHERE id = $1 AND comments_count > 0',
                [postId]
            );
            
            return { success: true, message: 'Comment deleted' };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Comment;