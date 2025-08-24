const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const verifyToken = (token) => {
    return jwt.verify(token, process.env.JWT_SECRET);
};

// Authentication middleware
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({
                message: 'Access denied. No token provided.'
            });
        }
        
        const decoded = verifyToken(token);
        const user = await User.findById(decoded.userId);
        
        if (!user) {
            return res.status(401).json({
                message: 'Invalid token. User not found.'
            });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        return res.status(401).json({
            message: 'Invalid token.'
        });
    }
};

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            // No token, continue as guest
            return next();
        }
        
        try {
            const decoded = verifyToken(token);
            const user = await User.findById(decoded.userId);
            
            if (user) {
                req.user = user;
            }
        } catch (tokenError) {
            // Invalid token, but don't block the request
            console.error('Optional auth token error:', tokenError.message);
        }
        
        next();
    } catch (error) {
        // Continue even if auth fails
        console.error('Optional auth error:', error.message);
        next();
    }
};

module.exports = {
    authenticateToken,
    optionalAuth,
    verifyToken
};