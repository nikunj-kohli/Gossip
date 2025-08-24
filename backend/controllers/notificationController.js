const Notification = require('../models/Notification');

// Get all notifications for the current user
exports.getNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const notifications = await Notification.getForUser(userId, limit, offset);
        
        return res.status(200).json(notifications);
    } catch (error) {
        console.error('Error getting notifications:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const count = await Notification.getUnreadCount(userId);
        
        return res.status(200).json({ unreadCount: count });
    } catch (error) {
        console.error('Error getting unread notification count:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;
        
        const result = await Notification.markAsRead(notificationId, userId);
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        
        if (error.message === 'Notification not found or does not belong to user') {
            return res.status(404).json({ message: error.message });
        }
        
        return res.status(500).json({ message: 'Server error' });
    }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await Notification.markAllAsRead(userId);
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.user.id;
        
        await Notification.delete(notificationId, userId);
        
        return res.status(200).json({ message: 'Notification deleted successfully' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        
        if (error.message === 'Notification not found or does not belong to user') {
            return res.status(404).json({ message: error.message });
        }
        
        return res.status(500).json({ message: 'Server error' });
    }
};

// Delete all notifications
exports.deleteAllNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const result = await Notification.deleteAll(userId);
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error deleting all notifications:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Get notification preferences
exports.getPreferences = async (req, res) => {
    try {
        const userId = req.user.id;
        
        const preferences = await Notification.getPreferences(userId);
        
        return res.status(200).json(preferences);
    } catch (error) {
        console.error('Error getting notification preferences:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Update notification preference
exports.updatePreference = async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, status } = req.body;
        
        if (!type || !status) {
            return res.status(400).json({ message: 'Notification type and status are required' });
        }
        
        const result = await Notification.updatePreference(userId, type, status);
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error updating notification preference:', error);
        
        if (error.message === 'Invalid status value' || error.message === 'Invalid notification type') {
            return res.status(400).json({ message: error.message });
        }
        
        return res.status(500).json({ message: 'Server error' });
    }
};