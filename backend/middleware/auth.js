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
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            console.warn(`Auth failed: User ${decoded.userId} not found in database`);
            return res.status(401).json({ message: 'User not found' });
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
    const user = await User.findById(decoded.userId);
    
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