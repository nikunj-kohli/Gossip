const express = require('express');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const gamificationController = require('../controllers/gamificationController');

const router = express.Router();

// Routes with optional authentication
router.get('/leaderboard/points', optionalAuth, gamificationController.getPointsLeaderboard);
router.get('/leaderboard/reputation', optionalAuth, gamificationController.getReputationLeaderboard);

// Routes requiring authentication
router.use(authenticateToken);

// Achievements
router.get('/achievements', gamificationController.getAvailableAchievements);
router.get('/achievements/categories', gamificationController.getAchievementCategories);
router.get('/users/:userId/achievements', gamificationController.getUserAchievements);

// Points
router.get('/points', gamificationController.getUserPoints);
router.get('/points/transactions', gamificationController.getUserPointTransactions);
router.get('/users/:userId/points', gamificationController.getUserPoints);

// Reputation
router.get('/reputation', gamificationController.getUserReputation);
router.get('/users/:userId/reputation', gamificationController.getUserReputation);

// Daily login
router.post('/login/daily', gamificationController.recordDailyLogin);

// Activity stats
router.get('/activity', gamificationController.getUserActivity);
router.get('/users/:userId/activity', gamificationController.getUserActivity);

module.exports = router;