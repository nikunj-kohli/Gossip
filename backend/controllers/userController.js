const User = require('../models/User');

// Get user profile by username
const getUserProfile = async (req, res) => {
    try {
        const { username } = req.params;
        
        console.log('getUserProfile called with username:', username); // Debug log
        
        if (!username) {
            console.log('Username is missing in request');
            return res.status(400).json({ message: 'Username is required' });
        }
        
        const user = await User.findByUsername(username);
        
        console.log('User found:', user); // Debug what User.getByUsername returns
        
        if (!user) {
            console.log('User not found for username:', username);
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Don't return sensitive information
        const { password_hash, ...safeUserData } = user;
        
        console.log('Returning safe user data:', safeUserData); // Debug what we return
        res.json(safeUserData);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getUserProfile
};
