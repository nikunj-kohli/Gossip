const Achievement = require('../models/Achievement');
const Points = require('../models/Points');
const Reputation = require('../models/Reputation');
const GamificationService = require('../services/gamificationService');

// Get user achievements
exports.getUserAchievements = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    const achievements = await Achievement.getUserAchievements(userId);
    
    return res.status(200).json(achievements);
  } catch (error) {
    console.error('Error getting user achievements:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get available achievements with progress
exports.getAvailableAchievements = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const achievements = await Achievement.getUserAvailableAchievements(userId);
    
    return res.status(200).json(achievements);
  } catch (error) {
    console.error('Error getting available achievements:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get achievement categories
exports.getAchievementCategories = async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT category FROM achievements
      ORDER BY category
    `;
    
    const result = await db.query(query);
    const categories = result.rows.map(row => row.category);
    
    return res.status(200).json(categories);
  } catch (error) {
    console.error('Error getting achievement categories:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get user points
exports.getUserPoints = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    const points = await Points.getUserPoints(userId);
    
    return res.status(200).json(points);
  } catch (error) {
    console.error('Error getting user points:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get user point transactions
exports.getUserPointTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const transactions = await Points.getUserTransactions(userId, limit, offset);
    
    return res.status(200).json(transactions);
  } catch (error) {
    console.error('Error getting user point transactions:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get points leaderboard
exports.getPointsLeaderboard = async (req, res) => {
  try {
    const period = req.query.period || 'all';
    const limit = parseInt(req.query.limit) || 10;
    
    // Validate period
    const validPeriods = ['day', 'week', 'month', 'all'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ message: 'Invalid period' });
    }
    
    const leaderboard = await Points.getLeaderboard(period, limit);
    
    // If user is authenticated, get their rank
    let userRank = null;
    if (req.user) {
      userRank = await Points.getUserRank(req.user.id, period);
    }
    
    return res.status(200).json({
      leaderboard,
      userRank
    });
  } catch (error) {
    console.error('Error getting points leaderboard:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get user reputation
exports.getUserReputation = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    const reputation = await Reputation.getUserReputation(userId);
    
    return res.status(200).json(reputation);
  } catch (error) {
    console.error('Error getting user reputation:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get reputation leaderboard
exports.getReputationLeaderboard = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const leaderboard = await Reputation.getLeaderboard(limit);
    
    // If user is authenticated, get their rank
    let userRank = null;
    if (req.user) {
      userRank = await Reputation.getUserRank(req.user.id);
    }
    
    return res.status(200).json({
      leaderboard,
      userRank
    });
  } catch (error) {
    console.error('Error getting reputation leaderboard:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Record daily login
exports.recordDailyLogin = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await GamificationService.recordDailyLogin(userId);
    
    if (!result) {
      return res.status(200).json({ 
        message: 'Already logged in today',
        alreadyLoggedIn: true
      });
    }
    
    return res.status(200).json({
      message: 'Daily login recorded',
      points: result.result.userPoints,
      streak: result.streak
    });
  } catch (error) {
    console.error('Error recording daily login:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get user activity counts
exports.getUserActivity = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.id;
    
    const activity = await GamificationService.getUserActivityCounts(userId);
    
    return res.status(200).json(activity);
  } catch (error) {
    console.error('Error getting user activity:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};