const Like = require('../models/Like');
const Post = require('../models/Post');

// Toggle like on post (like if not liked, unlike if already liked)
const toggleLike = async (req, res) => {
    try {
        const { id } = req.params; // Post ID
        const userId = req.user.id;

        // Check if post exists
        const post = await Post.findById(id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        // Check if already liked
        const isLiked = await Like.checkLiked(userId, id);

        let response;
        if (isLiked) {
            // Remove like if already liked
            response = await Like.removeLike(userId, id);
            res.json({ message: 'Post unliked successfully', liked: false });
        } else {
            // Add like if not liked
            response = await Like.addLike(userId, id);
            res.json({ message: 'Post liked successfully', liked: true });
        }

    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get users who liked a post
const getLikes = async (req, res) => {
    try {
        const { id } = req.params; // Post ID
        const limit = parseInt(req.query.limit) || 10;

        // Check if post exists
        const post = await Post.findById(id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const likes = await Like.getLikesByPost(id, limit);
        const count = await Like.getLikesCount(id);

        res.json({
            count,
            likes
        });

    } catch (error) {
        console.error('Error getting likes:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    toggleLike,
    getLikes
};