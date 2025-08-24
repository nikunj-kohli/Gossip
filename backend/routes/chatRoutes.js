const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const chatController = require('../controllers/chatController');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Chat rooms
router.post('/rooms', chatController.createRoom);
router.get('/rooms', chatController.getRooms);
router.get('/rooms/:roomId', chatController.getRoomById);

// Chat messages
router.get('/rooms/:roomId/messages', chatController.getMessages);
router.post('/rooms/:roomId/messages', chatController.sendMessage);
router.delete('/messages/:messageId', chatController.deleteMessage);
router.put('/messages/:messageId', chatController.editMessage);

// Room membership
router.post('/rooms/:roomId/members', chatController.addMember);
router.delete('/rooms/:roomId/members/:userId', chatController.removeMember);

// Read status
router.post('/rooms/:roomId/read', chatController.markAsRead);
router.get('/unread', chatController.getUnreadCount);

// Online status
router.post('/status', chatController.getOnlineStatus);
router.get('/online', chatController.getOnlineUsers);

module.exports = router;