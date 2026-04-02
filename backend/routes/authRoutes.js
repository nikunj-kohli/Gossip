const express = require('express');
const {
	register,
	login,
	getProfile,
	validateToken,
	sendForgotPasswordOtp,
	verifyForgotPasswordOtp,
	resetPasswordWithOtp,
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password/send-otp', sendForgotPasswordOtp);
router.post('/forgot-password/verify-otp', verifyForgotPasswordOtp);
router.post('/forgot-password/reset', resetPasswordWithOtp);
router.get('/validate', authenticateToken, validateToken);

// Protected routes
router.get('/profile', authenticateToken, getProfile);

module.exports = router;