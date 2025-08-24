const PostView = require('../models/PostView');

// Middleware to track post views
const trackPostView = async (req, res, next) => {
  try {
    // Skip if not a post request
    if (!req.params.postId) {
      return next();
    }
    
    // Get post ID from params
    const postId = req.params.postId;
    
    // Track view asynchronously - don't block request
    const userId = req.user ? req.user.id : null;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;
    
    // Record view without awaiting to not block the request
    PostView.recordView(postId, { userId, ipAddress, userAgent })
      .catch(error => console.error('Error tracking post view:', error));
    
    // Continue with request
    next();
  } catch (error) {
    // Don't fail the request if view tracking fails
    console.error('Error in view tracking middleware:', error);
    next();
  }
};

module.exports = {
  trackPostView
};