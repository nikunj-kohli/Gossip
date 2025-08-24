const Comment = require('../models/Comment');
const Post = require('../models/Post');

// Add comment to post
const addComment = async (req, res) => {
    try {
        const { id } = req.params; // Post ID
        const { content, isAnonymous = false } = req.body;
        const userId = req.user.id;

        // Validation
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ message: 'Comment content is required' });
        }

        if (content.length > 500) {
            return res.status(400).json({ message: 'Comment too long (max 500 characters)' });
        }

        // Check if post exists
        const post = await Post.findById(id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Create comment
        const comment = await Comment.addComment(
            userId,
            id,
            content.trim(),
            isAnonymous
        );

        res.status(201).json({
            message: 'Comment added successfully',
            comment
        });

    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get comments for a post
const getComments = async (req, res) => {
    try {
        const { id } = req.params; // Post ID
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        // Check if post exists
        const post = await Post.findById(id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const comments = await Comment.getCommentsByPost(id, limit, offset);

        res.json({
            comments,
            pagination: {
                limit,
                offset,
                count: comments.length
            }
        });

    } catch (error) {
        console.error('Error getting comments:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Delete a comment
const deleteComment = async (req, res) => {
    try {
        const { id, commentId } = req.params;
        const userId = req.user.id;

        const result = await Comment.deleteComment(commentId, userId);

        if (!result.success) {
            return res.status(404).json({ message: result.message });
        }

        res.json({ message: 'Comment deleted successfully' });

    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    addComment,
    getComments,
    deleteComment
};