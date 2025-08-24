const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Start or get a conversation with another user
exports.startConversation = async (req, res) => {
    try {
        const { userId } = req.params;
        const { isAnonymous } = req.body;
        const currentUserId = req.user.id;
        
        // Check if target user exists
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Prevent starting conversation with self
        if (currentUserId === userId) {
            return res.status(400).json({ message: 'Cannot start conversation with yourself' });
        }
        
        // Find or create conversation
        const conversation = await Conversation.findOrCreateOneToOne(
            currentUserId, 
            userId,
            isAnonymous || false
        );
        
        return res.status(200).json(conversation);
    } catch (error) {
        console.error('Error starting conversation:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Get all conversations for current user
exports.getConversations = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const conversations = await Conversation.getAllForUser(currentUserId, limit, offset);
        
        return res.status(200).json(conversations);
    } catch (error) {
        console.error('Error getting conversations:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Get specific conversation by ID
exports.getConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.user.id;
        
        const conversation = await Conversation.findById(conversationId, currentUserId);
        
        if (!conversation) {
            return res.status(404).json({ message: 'Conversation not found' });
        }
        
        return res.status(200).json(conversation);
    } catch (error) {
        console.error('Error getting conversation:', error);
        
        if (error.message === 'User is not a member of this conversation') {
            return res.status(403).json({ message: error.message });
        }
        
        return res.status(500).json({ message: 'Server error' });
    }
};

// Leave a conversation
exports.leaveConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.user.id;
        
        await Conversation.leave(conversationId, currentUserId);
        
        return res.status(200).json({ message: 'Successfully left conversation' });
    } catch (error) {
        console.error('Error leaving conversation:', error);
        
        if (error.message === 'User is not a member of this conversation') {
            return res.status(403).json({ message: error.message });
        }
        
        return res.status(500).json({ message: 'Server error' });
    }
};

// Send a message
exports.sendMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { content, isAnonymous } = req.body;
        const currentUserId = req.user.id;
        
        // Validate content
        if (!content || content.trim() === '') {
            return res.status(400).json({ message: 'Message content cannot be empty' });
        }
        
        // Check if user is part of the conversation
        try {
            await Conversation.findById(conversationId, currentUserId);
        } catch (error) {
            return res.status(403).json({ message: 'User is not a member of this conversation' });
        }
        
        // Create message
        const message = await Message.create({
            senderId: currentUserId,
            conversationId,
            content,
            isAnonymous: isAnonymous || false
        });
        
        return res.status(201).json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

// Get messages in a conversation
exports.getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.user.id;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const messages = await Message.getByConversation(
            conversationId, 
            currentUserId,
            limit,
            offset
        );
        
        return res.status(200).json(messages);
    } catch (error) {
        console.error('Error getting messages:', error);
        
        if (error.message === 'User is not a member of this conversation') {
            return res.status(403).json({ message: error.message });
        }
        
        return res.status(500).json({ message: 'Server error' });
    }
};

// Mark a message as read
exports.markAsRead = async (req, res) => {
    try {
        const { messageId } = req.params;
        const currentUserId = req.user.id;
        
        const result = await Message.markAsRead(messageId, currentUserId);
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error marking message as read:', error);
        
        if (error.message === 'User cannot mark this message as read') {
            return res.status(403).json({ message: error.message });
        }
        
        return res.status(500).json({ message: 'Server error' });
    }
};

// Mark all messages in a conversation as read
exports.markAllAsRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.user.id;
        
        const result = await Message.markAllAsRead(conversationId, currentUserId);
        
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error marking all messages as read:', error);
        
        if (error.message === 'User is not a member of this conversation') {
            return res.status(403).json({ message: error.message });
        }
        
        return res.status(500).json({ message: 'Server error' });
    }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const currentUserId = req.user.id;
        
        await Message.delete(messageId, currentUserId);
        
        return res.status(200).json({ message: 'Message deleted successfully' });
    } catch (error) {
        console.error('Error deleting message:', error);
        
        if (error.message === 'User can only delete their own messages') {
            return res.status(403).json({ message: error.message });
        }
        
        return res.status(500).json({ message: 'Server error' });
    }
};

// Get unread message count
exports.getUnreadCount = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        
        const count = await Message.getUnreadCount(currentUserId);
        
        return res.status(200).json({ unreadCount: count });
    } catch (error) {
        console.error('Error getting unread count:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};