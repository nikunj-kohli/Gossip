const express = require('express');
const { register, metricsMiddleware, errorMetricsMiddleware } = require('../services/metricsService');
const { authenticateToken, isAdmin } = require('../middleware/auth');

const router = express.Router();

// Metrics endpoint (protected for admin access only)
router.get('/metrics', authenticateToken, isAdmin, async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Health check endpoint (public)
router.get('/health', (req, res) => {
  res.json({
    status: 'up',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

module.exports = {
  router,
  metricsMiddleware,
  errorMetricsMiddleware
};