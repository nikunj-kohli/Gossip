const express = require('express');
const { register, login, getProfile, validateToken } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/validate', authenticateToken, validateToken);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

module.exports = router;