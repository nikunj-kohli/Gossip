const express = require('express');
const router = express.Router();
const { getUserProfile } = require('../controllers/userController');

// GET /api/users/:username - Get user profile by username
router.get('/:username', getUserProfile);

module.exports = router;
