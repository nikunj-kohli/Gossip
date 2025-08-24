const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const messageController = require('../controllers/messageController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Conversation routes
router.post('/users/:userId', messageController.startConversation);
router.get('/', messageController.getConversations);
router.get('/unread', messageController.getUnreadCount);
router.get('/:conversationId', messageController.getConversation);
router.post('/:conversationId/leave', messageController.leaveConversation);

// Message routes
router.post('/:conversationId/messages', messageController.sendMessage);
router.get('/:conversationId/messages', messageController.getMessages);
router.put('/:conversationId/read', messageController.markAllAsRead);
router.put('/messages/:messageId/read', messageController.markAsRead);
router.delete('/messages/:messageId', messageController.deleteMessage);

module.exports = router;