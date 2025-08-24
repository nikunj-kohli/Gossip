const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

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

module.exports = {
    register,
    login,
    getProfile
};