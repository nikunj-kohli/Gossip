const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const {
    canResendOtp,
    createOtp,
    clearOtp,
    verifyOtp,
    consumeResetToken,
    normalizeEmail,
} = require('../services/passwordResetOtpService');
const { sendPasswordOtpEmail } = require('../services/emailService');

// Register new user
const register = async (req, res) => {
    try {
        const { username, email, password, displayName } = req.body;

        // Validation
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Username, email, and password are required' });
        }

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email already exists' });
        }

        const existingUsername = await User.findByUsername(username);
        if (existingUsername) {
            return res.status(400).json({ message: 'Username is already taken' });
        }

        // Create user
        const user = await User.create({
            username,
            email,
            password,
            displayName: displayName || username
        });

        // Generate JWT token
        const token = generateToken({ userId: user.id, username: user.username });

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName: user.display_name
            },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Login user
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isValidPassword = await User.verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = generateToken({ userId: user.id, username: user.username });

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                displayName: user.display_name
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get current user profile
const getProfile = async (req, res) => {
    try {
        res.json({
            user: {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email,
                displayName: req.user.display_name,
                bio: req.user.bio,
                createdAt: req.user.created_at
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Validate token
const validateToken = async (req, res) => {
    try {
        // If we reach here, the token is valid (due to authenticateToken middleware)
        res.json({ valid: true, user: req.user });
    } catch (error) {
        console.error('Token validation error:', error);
        res.status(500).json({ valid: false });
    }
};

// Send OTP for forgot password
const sendForgotPasswordOtp = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email || '');

        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(404).json({ message: 'No account found with this email' });
        }

        const resendState = canResendOtp(email);
        if (!resendState.allowed) {
            return res.status(429).json({
                message: 'Please wait before requesting another OTP',
                retryAfterSeconds: Math.ceil(resendState.retryAfterMs / 1000),
            });
        }

        const { otp, expiresInSeconds } = createOtp(email);
        const mailResult = await Promise.race([
            sendPasswordOtpEmail(user, otp),
            new Promise((resolve) => {
                setTimeout(() => resolve({ success: false, timeout: true }), 10000);
            }),
        ]);

        if (!mailResult.success) {
            clearOtp(email);
            return res.status(500).json({ message: 'Failed to send OTP email' });
        }

        return res.json({
            message: 'OTP sent to your email',
            expiresInSeconds,
        });
    } catch (error) {
        console.error('Send forgot password OTP error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Verify OTP for forgot password
const verifyForgotPasswordOtp = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email || '');
        const otp = String(req.body?.otp || '').trim();

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const result = verifyOtp(email, otp);
        if (!result.valid) {
            const reasonMessages = {
                OTP_NOT_FOUND: 'OTP not found. Request a new one.',
                OTP_EXPIRED: 'OTP expired. Request a new one.',
                TOO_MANY_ATTEMPTS: 'Too many failed attempts. Request a new OTP.',
                OTP_INVALID: 'Invalid OTP',
            };

            return res.status(400).json({ message: reasonMessages[result.reason] || 'OTP verification failed' });
        }

        return res.json({
            message: 'OTP verified successfully',
            resetToken: result.resetToken,
            resetTokenExpiresInSeconds: result.resetTokenExpiresInSeconds,
        });
    } catch (error) {
        console.error('Verify forgot password OTP error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Reset password using verified OTP reset token
const resetPasswordWithOtp = async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email || '');
        const resetToken = String(req.body?.resetToken || '').trim();
        const newPassword = String(req.body?.newPassword || '');

        if (!email || !resetToken || !newPassword) {
            return res.status(400).json({ message: 'Email, reset token, and new password are required' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long' });
        }

        const tokenState = consumeResetToken(email, resetToken);
        if (!tokenState.valid) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        const updatedUser = await User.updatePasswordByEmail(email, newPassword);
        if (!updatedUser) {
            return res.status(404).json({ message: 'No account found with this email' });
        }

        return res.json({ message: 'Password reset successful. You can now log in.' });
    } catch (error) {
        console.error('Reset password with OTP error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    register,
    login,
    getProfile,
    validateToken,
    sendForgotPasswordOtp,
    verifyForgotPasswordOtp,
    resetPasswordWithOtp,
};