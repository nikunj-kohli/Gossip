// Admin authentication middleware

// Middleware to check if user is an admin
const isAdmin = (req, res, next) => {
  // Check if user exists and is authenticated
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Check if user is an admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin privileges required' });
  }
  
  next();
};

// Middleware to check if user is an admin or moderator
const isAdminOrModerator = (req, res, next) => {
  // Check if user exists and is authenticated
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Check if user is an admin or moderator
  if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
    return res.status(403).json({ message: 'Moderation privileges required' });
  }
  
  next();
};

module.exports = {
  isAdmin,
  isAdminOrModerator
};