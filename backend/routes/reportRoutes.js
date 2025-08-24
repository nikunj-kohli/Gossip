const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { isAdminOrModerator } = require('../middleware/adminAuth');
const reportController = require('../controllers/reportController');

const router = express.Router();

// User routes (require regular authentication)
router.post('/', authenticateToken, reportController.submitReport);

// Admin routes (require admin/moderator privileges)
router.get('/', authenticateToken, isAdminOrModerator, reportController.getReports);
router.get('/counts', authenticateToken, isAdminOrModerator, reportController.getReportCounts);
router.get('/:reportId', authenticateToken, isAdminOrModerator, reportController.getReportById);
router.put('/:reportId/status', authenticateToken, isAdminOrModerator, reportController.updateReportStatus);
router.get('/entity/:entityType/:entityId', authenticateToken, isAdminOrModerator, reportController.getReportsForEntity);

// Content checking route
router.post('/check-content', authenticateToken, reportController.checkContent);

module.exports = router;