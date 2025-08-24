const Moderation = require('../models/Moderation');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');

// Moderate a post
exports.moderatePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { action, reason } = req.body;
    const moderatorId = req.user.id;
    
    // Validate action
    const validActions = ['hide', 'restore', 'flag', 'approve'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }
    
    // Check if post exists
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Take moderation action
    const result = await Moderation.moderatePost(
      postId,
      moderatorId,
      action,
      reason
    );
    
    return res.status(200).json({
      message: `Post ${action}ed successfully`,
      action: result
    });
  } catch (error) {
    console.error('Error moderating post:', error);
    
    if (error.message === 'Post not found') {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    if (error.message === 'Invalid moderation action') {
      return res.status(400).json({ message: 'Invalid moderation action' });
    }
    
    return res.status(500).json({ message: 'Server error' });
  }
};

// Moderate a comment
exports.moderateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { action, reason } = req.body;
    const moderatorId = req.user.id;
    
    // Validate action
    const validActions = ['hide', 'restore', 'flag', 'approve'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }
    
    // Check if comment exists
    // This would need your Comment model to have a findById method
    // const comment = await Comment.findById(commentId);
    // if (!comment) {
    //   return res.status(404).json({ message: 'Comment not found' });
    // }
    
    // Take moderation action
    const result = await Moderation.moderateComment(
      commentId,
      moderatorId,
      action,
      reason
    );
    
    return res.status(200).json({
      message: `Comment ${action}ed successfully`,
      action: result
    });
  } catch (error) {
    console.error('Error moderating comment:', error);
    
    if (error.message === 'Comment not found') {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    if (error.message === 'Invalid moderation action') {
      return res.status(400).json({ message: 'Invalid moderation action' });
    }
    
    return res.status(500).json({ message: 'Server error' });
  }
};

// Moderate a user
exports.moderateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, reason, duration } = req.body;
    const moderatorId = req.user.id;
    
    // Validate action
    const validActions = ['suspend', 'unsuspend', 'warn'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }
    
    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Prevent moderating other moderators or admins
    if (user.role === 'admin' || user.role === 'moderator') {
      return res.status(403).json({ message: 'Cannot moderate other moderators or admins' });
    }
    
    // Take moderation action
    const result = await Moderation.moderateUser(
      userId,
      moderatorId,
      action,
      reason,
      action === 'suspend' ? (duration || null) : null
    );
    
    return res.status(200).json({
      message: `User ${action}ed successfully`,
      action: result
    });
  } catch (error) {
    console.error('Error moderating user:', error);
    
    if (error.message === 'User not found') {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (error.message === 'Invalid moderation action') {
      return res.status(400).json({ message: 'Invalid moderation action' });
    }
    
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get moderation actions
exports.getModerationActions = async (req, res) => {
  try {
    const { entityType, entityId, moderatorId, action, limit, offset } = req.query;
    
    const options = {
      entityType: entityType || null,
      entityId: entityId || null,
      moderatorId: moderatorId || null,
      action: action || null,
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0
    };
    
    const result = await Moderation.getActions(options);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting moderation actions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get moderation stats
exports.getModerationStats = async (req, res) => {
  try {
    const stats = await Moderation.getStats();
    
    return res.status(200).json(stats);
  } catch (error) {
    console.error('Error getting moderation stats:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};