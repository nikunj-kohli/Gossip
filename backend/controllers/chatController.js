const ChatRoom = require('../models/ChatRoom');
const ChatMessage = require('../models/ChatMessage');
const socketManager = require('../utils/socketManager');

// Create a new chat room
exports.createRoom = async (req, res) => {
  try {
    const { name, type, userIds } = req.body;
    const creatorId = req.user.id;
    
    // Validate room type
    const validTypes = ['group', 'direct', 'channel'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ message: 'Invalid room type' });
    }
    
    // Validate user IDs
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ message: 'User IDs must be an array' });
    }
    
    // Create room
    const room = await ChatRoom.create({
      name: name || 'New Chat',
      type,
      creatorId,
      userIds,
      isPrivate: type === 'direct'
    });
    
    return res.status(201).json(room);
  } catch (error) {
    console.error('Error creating chat room:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get user's chat rooms
exports.getRooms = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await ChatRoom.findByUser(userId, limit, offset);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting chat rooms:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get chat room by ID
exports.getRoomById = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    
    const room = await ChatRoom.findById(roomId, userId);
    
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    // Check if user is a member
    if (!room.is_member) {
      return res.status(403).json({ message: 'You are not a member of this chat room' });
    }
    
    // Get room members
    const members = await ChatRoom.getMembers(roomId);
    room.members = members;
    
    return res.status(200).json(room);
  } catch (error) {
    console.error('Error getting chat room:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get messages for a room
exports.getMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await ChatMessage.findByRoom(roomId, userId, limit, offset);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting chat messages:', error);
    
    if (error.message === 'User is not a member of this chat room') {
      return res.status(403).json({ message: error.message });
    }
    
    return res.status(500).json({ message: 'Server error' });
  }
};

// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, type, metadata } = req.body;
    const senderId = req.user.id;
    
    // Validate content
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    // Verify user is a room member
    const room = await ChatRoom.findById(roomId, senderId);
    
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    if (!room.is_member) {
      return res.status(403).json({ message: 'You are not a member of this chat room' });
    }
    
    // Create message
    const message = await ChatMessage.create({
      roomId,
      senderId,
      content,
      type: type || 'text',
      metadata: metadata || {}
    });
    
    return res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    
    const result = await ChatMessage.delete(messageId, userId);
    
    return res.status(200).json({
      message: 'Message deleted successfully',
      id: messageId
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    
    if (error.message === 'Message not found') {
      return res.status(404).json({ message: 'Message not found' });
    }
    
    if (error.message === 'Not authorized to delete this message') {
      return res.status(403).json({ message: 'Not authorized to delete this message' });
    }
    
    return res.status(500).json({ message: 'Server error' });
  }
};

// Edit a message
exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    
    // Validate content
    if (!content || content.trim() === '') {
      return res.status(400).json({ message: 'Message content is required' });
    }
    
    const result = await ChatMessage.edit(messageId, userId, content);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error editing message:', error);
    
    if (error.message === 'Message not found or not authorized to edit') {
      return res.status(403).json({ message: 'Message not found or not authorized to edit' });
    }
    
    return res.status(500).json({ message: 'Server error' });
  }
};

// Add user to room
exports.addMember = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, role } = req.body;
    const currentUserId = req.user.id;
    
    // Validate role
    const validRoles = ['member', 'moderator', 'admin'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    
    // Verify current user is a room admin
    const room = await ChatRoom.findById(roomId, currentUserId);
    
    if (!room) {
      return res.status(404).json({ message: 'Chat room not found' });
    }
    
    if (!room.is_member) {
      return res.status(403).json({ message: 'You are not a member of this chat room' });
    }
    
    // Get current user's role
    const members = await ChatRoom.getMembers(roomId);
    const currentUser = members.find(m => m.id === currentUserId);
    
    if (!currentUser || (currentUser.role !== 'admin' && room.creator_id !== currentUserId)) {
      return res.status(403).json({ message: 'Only room admins can add members' });
    }
    
    // Add member
    const result = await ChatRoom.addMember(roomId, userId, role || 'member');
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error adding member to chat room:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Remove user from room
exports.removeMember = async (req, res) => {
  try {
    const { roomId, userId } = req.params;
    const currentUserId = req.user.id;
    
    // Verify current user is a room admin or the user themselves
    if (userId !== currentUserId) {
      const room = await ChatRoom.findById(roomId, currentUserId);
      
      if (!room) {
        return res.status(404).json({ message: 'Chat room not found' });
      }
      
      if (!room.is_member) {
        return res.status(403).json({ message: 'You are not a member of this chat room' });
      }
      
      // Get current user's role
      const members = await ChatRoom.getMembers(roomId);
      const currentUser = members.find(m => m.id === currentUserId);
      
      if (!currentUser || (currentUser.role !== 'admin' && room.creator_id !== currentUserId)) {
        return res.status(403).json({ message: 'Only room admins can remove members' });
      }
    }
    
    // Remove member
    const result = await ChatRoom.removeMember(roomId, userId);
    
    if (!result) {
      return res.status(404).json({ message: 'User is not a member of this chat room' });
    }
    
    return res.status(200).json({
      message: 'Member removed successfully',
      roomId,
      userId
    });
  } catch (error) {
    console.error('Error removing member from chat room:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Mark room as read
exports.markAsRead = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;
    
    const result = await ChatRoom.markAsRead(roomId, userId);
    
    if (!result) {
      return res.status(404).json({ message: 'User is not a member of this chat room' });
    }
    
    return res.status(200).json({
      message: 'Room marked as read',
      roomId
    });
  } catch (error) {
    console.error('Error marking room as read:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get unread messages count
exports.getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const count = await ChatRoom.getTotalUnreadCount(userId);
    
    return res.status(200).json({
      unreadCount: count
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get online status of users
exports.getOnlineStatus = async (req, res) => {
  try {
    const { userIds } = req.body;
    
    if (!Array.isArray(userIds)) {
      return res.status(400).json({ message: 'User IDs must be an array' });
    }
    
    const statusMap = {};
    
    userIds.forEach(userId => {
      statusMap[userId] = socketManager.getUserStatus(userId);
    });
    
    return res.status(200).json(statusMap);
  } catch (error) {
    console.error('Error getting online status:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Get all online users
exports.getOnlineUsers = async (req, res) => {
  try {
    const onlineUsers = socketManager.getOnlineUsers();
    
    return res.status(200).json(onlineUsers);
  } catch (error) {
    console.error('Error getting online users:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};