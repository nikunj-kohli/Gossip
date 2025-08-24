const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get notifications
router.get('/', notificationController.getNotifications);
router.get('/unread/count', notificationController.getUnreadCount);

// Mark notifications as read
router.put('/:notificationId/read', notificationController.markAsRead);
router.put('/read/all', notificationController.markAllAsRead);

// Delete notifications
router.delete('/:notificationId', notificationController.deleteNotification);
router.delete('/', notificationController.deleteAllNotifications);

// Notification preferences
router.get('/preferences', notificationController.getPreferences);
router.put('/preferences', notificationController.updatePreference);

module.exports = router;