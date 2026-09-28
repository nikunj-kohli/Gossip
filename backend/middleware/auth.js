const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    try {
        const decoded = verifyToken(token);
        const userId = decoded.userId || decoded.id;
        const user = await User.findById(userId);
        
        if (!user) {
            console.warn(`Auth failed: User ${userId} not found in database`);
            return res.status(401).json({ message: 'User not found' });
        }

        // Block deactivated or actively suspended accounts even with a valid
        // token (moderation must be able to cut access before token expiry).
        if (user.is_active === false) {
            return res.status(403).json({ message: 'Account is deactivated' });
        }
        if (user.moderation_status === 'suspended' || user.moderation_status === 'banned') {
            const until = user.suspension_end_date ? new Date(user.suspension_end_date) : null;
            const stillSuspended = !until || until > new Date();
            if (stillSuspended) {
                return res.status(403).json({ message: 'Account is suspended' });
            }
        }

        req.user = user;
        next();
    } catch (error) {
        console.warn(`Auth failed: ${error.message}. Token prefix: ${token.substring(0, 10)}...`);
        return res.status(401).json({ 
            message: 'Invalid or expired token',
            error: 'UNAUTHORIZED'
        });
    }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    // Continue without user authentication
    return next();
  }
  
  try {
    const decoded = verifyToken(token);
    const userId = decoded.userId || decoded.id;
    const user = await User.findById(userId);
    
    if (user) {
      req.user = user;
    }
  } catch (error) {
    // Invalid token, but continue without authentication
    console.log('Optional auth token invalid:', error.message);
  }
  
  next();
};

module.exports = {
    authenticateToken,
    optionalAuth,
    isAdmin: (req, res, next) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Admin access required' });
        }
        next();
    }
};