const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// Start or get a conversation with another user
exports.startConversation = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        const isAnonymous = req.body && req.body.isAnonymous ? req.body.isAnonymous : false;
        
        console.log('=== CONVERSATION DEBUG ===');
        console.log('req.params:', req.params);
        console.log('req.user:', req.user);
        console.log('userId param:', userId);
        console.log('currentUserId:', currentUserId);
        console.log('req.body:', req.body);
        console.log('isAnonymous:', isAnonymous);
        console.log('userId type:', typeof userId);
        console.log('currentUserId type:', typeof currentUserId);
        console.log('Comparing userIds:', userId, '===', currentUserId, '=', userId == currentUserId);
        
        let targetUser;
        
        // Check if parameter is username or userId
        if (isNaN(userId)) {
            // It's a username, find by username
            console.log('Finding user by username:', userId);
            targetUser = await User.findByUsername(userId);
        } else {
            // It's a userId, find by id
            console.log('Finding user by ID:', userId);
            targetUser = await User.findById(userId);
        }
        
        console.log('Target user found:', targetUser);
        
        if (!targetUser) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Prevent starting conversation with self
        if (currentUserId == targetUser.id) {
            console.log('Cannot start conversation with self');
            return res.status(400).json({ message: 'Cannot start conversation with yourself' });
        }
        
        console.log('Finding/creating conversation between:', currentUserId, 'and', targetUser.id);
        
        // Find or create conversation
        const conversation = await Conversation.findOrCreateOneToOne(
            currentUserId, 
            targetUser.id,
            isAnonymous || false
        );
        
        console.log('Conversation result:', conversation);
        
        return res.status(200).json(conversation);
    } catch (error) {
        console.error('=== CONVERSATION ERROR ===');
        console.error('Error starting conversation:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Error details:', error);
        
        // Return detailed error for debugging
        return res.status(500).json({ 
            message: 'Server error',
            details: error.message,
            stack: error.stack,
            type: error.constructor.name
        });
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
        const { content, message_type, messageType, isAnonymous } = req.body;
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
            messageType: message_type || messageType || 'text',
            isAnonymous: isAnonymous || false
        });
        
        // Emit real-time message to conversation participants
        const io = global.io;
        if (io) {
            // Get conversation details to find other participant
            const conversation = await Conversation.findById(conversationId, currentUserId);
            const otherUserId = conversation.user1_id === currentUserId ? conversation.user2_id : conversation.user1_id;
            
            // Emit to conversation room
            io.to(`conversation:${conversationId}`).emit('message:received', {
                ...message,
                conversationId: parseInt(conversationId),
                senderId: currentUserId,
                // Ensure field names match frontend expectations
                message_type: message.message_type || message.messageType,
                messageType: message.message_type || message.messageType
            });
            
            // Emit conversation update to update conversation list
            io.emit('conversation:update', {
                conversationId: parseInt(conversationId),
                last_message: content,
                last_message_at: message.created_at,
                unread_count: 1 // Increment for other user
            });
        }
        
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