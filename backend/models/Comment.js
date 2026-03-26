const db = require('../config/database');

class Comment {
    static async getById(commentId) {
        const result = await db.query(
            `SELECT id, post_id, user_id, parent_comment_id FROM comments WHERE id = $1`,
            [commentId]
        );
        return result.rows[0] || null;
    }

    // Add comment to post
    static async addComment(userId, postId, content, isAnonymous = false, parentCommentId = null) {
        try {
            const query = `
                INSERT INTO comments (user_id, post_id, content, is_anonymous, parent_comment_id)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, user_id, post_id, content, is_anonymous, parent_comment_id, created_at
            `;
            const result = await db.query(query, [userId, postId, content, isAnonymous, parentCommentId]);
            
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
    static async getCommentsByPost(postId, limit = 20, offset = 0, currentUserId = null) {
        try {
            const query = `
                SELECT 
                    c.id, 
                    c.post_id,
                    c.user_id,
                    c.parent_comment_id,
                    c.content, 
                    c.is_anonymous, 
                    c.created_at,
                    COALESCE(cl.likes_count, 0)::int as likes_count,
                    COALESCE(ul.user_liked, false) as user_liked,
                    CASE 
                        WHEN c.is_anonymous = true THEN 'Anonymous'
                        ELSE COALESCE(u.display_name, u.username)
                    END as author
                FROM comments c
                LEFT JOIN users u ON c.user_id = u.id
                LEFT JOIN (
                    SELECT comment_id, COUNT(*)::int as likes_count
                    FROM comment_likes
                    GROUP BY comment_id
                ) cl ON cl.comment_id = c.id
                LEFT JOIN (
                    SELECT comment_id, true as user_liked
                    FROM comment_likes
                    WHERE user_id = $4
                ) ul ON ul.comment_id = c.id
                WHERE c.post_id = $1
                ORDER BY c.created_at ASC
                LIMIT $2 OFFSET $3
            `;
            const result = await db.query(query, [postId, limit, offset, currentUserId]);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    static async toggleLike(commentId, userId) {
        try {
            const existsQuery = `
                SELECT id FROM comment_likes
                WHERE comment_id = $1 AND user_id = $2
                LIMIT 1
            `;
            const existsResult = await db.query(existsQuery, [commentId, userId]);

            let liked;
            if (existsResult.rows.length > 0) {
                await db.query(
                    'DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
                    [commentId, userId]
                );
                liked = false;
            } else {
                await db.query(
                    'INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)',
                    [commentId, userId]
                );
                liked = true;
            }

            const countResult = await db.query(
                'SELECT COUNT(*)::int as likes_count FROM comment_likes WHERE comment_id = $1',
                [commentId]
            );

            return {
                liked,
                likesCount: countResult.rows[0]?.likes_count || 0,
            };
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

            // Delete comment and all descendants; adjust counter by total deleted rows.
            const deleteResult = await db.query(
                `WITH RECURSIVE comment_tree AS (
                    SELECT id FROM comments WHERE id = $1
                    UNION ALL
                    SELECT c.id
                    FROM comments c
                    INNER JOIN comment_tree ct ON c.parent_comment_id = ct.id
                ),
                deleted AS (
                    DELETE FROM comments
                    WHERE id IN (SELECT id FROM comment_tree)
                    RETURNING id
                )
                SELECT COUNT(*)::int as deleted_count FROM deleted`,
                [commentId]
            );

            const deletedCount = deleteResult.rows[0]?.deleted_count || 0;

            if (deletedCount > 0) {
                await db.query(
                    `UPDATE posts
                     SET comments_count = GREATEST(comments_count - $2, 0)
                     WHERE id = $1`,
                    [postId, deletedCount]
                );
            }
            
            return { success: true, message: 'Comment deleted' };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = Comment;