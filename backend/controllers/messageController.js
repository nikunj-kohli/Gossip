const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const redis = require('../services/enhancedRedisService');
const { MediaUploader } = require('../utils/mediaUploader');

const inboxCacheKey = {
    conversations: (userId) => `inbox:conversations:user:${userId}`,
    messages: (conversationId, userId) => `inbox:messages:conv:${conversationId}:user:${userId}`
};

const canUsersMessage = async (userId1, userId2) => {
    const relationship = await Friendship.checkFriendshipStatus(userId1, userId2);
    return Boolean(relationship && relationship.status === 'accepted');
};

const extractCloudinaryPublicIds = (messageRow) => {
    const ids = [];

    let attachments = [];
    const rawAttachments = messageRow?.attachments;
    if (Array.isArray(rawAttachments)) {
        attachments = rawAttachments;
    } else if (typeof rawAttachments === 'string') {
        try {
            attachments = JSON.parse(rawAttachments);
        } catch (e) {
            attachments = [];
        }
    } else if (rawAttachments && typeof rawAttachments === 'object') {
        attachments = [rawAttachments];
    }

    for (const a of attachments) {
        const candidate = a?.path || a?.public_id || a?.publicId || '';
        if (!candidate || typeof candidate !== 'string') continue;
        if (/^https?:\/\//i.test(candidate)) {
            // Convert URL style to Cloudinary public id if possible.
            const marker = '/upload/';
            const markerIdx = candidate.indexOf(marker);
            if (markerIdx === -1) continue;
            const pathAfterUpload = candidate.slice(markerIdx + marker.length);
            const withoutVersion = pathAfterUpload.replace(/^v\d+\//, '');
            const publicId = withoutVersion.replace(/\.[a-z0-9]+$/i, '');
            if (publicId) ids.push(publicId);
            continue;
        }
        ids.push(candidate);
    }

    return [...new Set(ids)];
};

// Start or get a conversation with another user
exports.startConversation = async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        const isAnonymous = req.body && req.body.isAnonymous ? req.body.isAnonymous : false;
        
        let targetUser;
        
        // Check if parameter is username or userId
        if (isNaN(userId)) {
            // It's a username, find by username
            targetUser = await User.findByUsername(userId);
        } else {
            // It's a userId, find by id
            targetUser = await User.findById(userId);
        }
        
        if (!targetUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Prevent starting conversation with self
        if (currentUserId == targetUser.id) {
            return res.status(400).json({ message: 'Cannot start conversation with yourself' });
        }

        const relationship = await Friendship.checkFriendshipStatus(currentUserId, targetUser.id);
        if (!relationship || relationship.status !== 'accepted') {
            return res.status(403).json({
                message: 'Message request must be accepted before starting a conversation'
            });
        }
        
        // Find or create conversation
        const conversation = await Conversation.findOrCreateOneToOne(
            currentUserId, 
            targetUser.id,
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
        
        if (limit === 20 && offset === 0) {
            const cached = await redis.get(inboxCacheKey.conversations(currentUserId));
            if (cached) {
                return res.status(200).json(cached);
            }
        }

        const conversations = await Conversation.getAllForUser(currentUserId, limit, offset);

        const filteredRows = [];
        for (const convo of (conversations.conversations || [])) {
            const otherUserId = convo.user1_id === currentUserId ? convo.user2_id : convo.user1_id;
            const allowed = await canUsersMessage(currentUserId, otherUserId);
            if (allowed) {
                filteredRows.push(convo);
            }
        }

        conversations.conversations = filteredRows;
        conversations.pagination = {
            ...conversations.pagination,
            count: filteredRows.length
        };

        if (limit === 20 && offset === 0) {
            await redis.set(inboxCacheKey.conversations(currentUserId), conversations, 30);
        }
        
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

        const otherUserId = conversation.user1_id === currentUserId ? conversation.user2_id : conversation.user1_id;
        const allowed = await canUsersMessage(currentUserId, otherUserId);
        if (!allowed) {
            return res.status(403).json({ message: 'Message request is no longer active' });
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

        let conversation = null;
        try {
            conversation = await Conversation.findById(conversationId, currentUserId);
        } catch (error) {
            conversation = null;
        }
        
        await Conversation.leave(conversationId, currentUserId);

        const otherUserId = conversation
            ? (conversation.user1_id === currentUserId ? conversation.user2_id : conversation.user1_id)
            : null;

        await Promise.all([
            redis.del(inboxCacheKey.conversations(currentUserId)),
            otherUserId ? redis.del(inboxCacheKey.conversations(otherUserId)) : Promise.resolve(),
            redis.del(inboxCacheKey.messages(conversationId, currentUserId)),
            otherUserId ? redis.del(inboxCacheKey.messages(conversationId, otherUserId)) : Promise.resolve()
        ]);
        
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
        const { content, message_type, messageType, isAnonymous, attachments = [] } = req.body;
        const currentUserId = req.user.id;
        
        const hasText = Boolean(content && String(content).trim().length > 0);
        const normalizedAttachments = Array.isArray(attachments) ? attachments.slice(0, 4) : [];

        if (!hasText && normalizedAttachments.length === 0) {
            return res.status(400).json({ message: 'Message content or attachment is required' });
        }
        
        // Check if user is part of the conversation
        let conversation;
        try {
            conversation = await Conversation.findById(conversationId, currentUserId);
        } catch (error) {
            return res.status(403).json({ message: 'User is not a member of this conversation' });
        }

        const otherUserId = conversation.user1_id === currentUserId ? conversation.user2_id : conversation.user1_id;
        const allowed = await canUsersMessage(currentUserId, otherUserId);
        if (!allowed) {
            return res.status(403).json({ message: 'Message request is no longer active' });
        }
        
        // Create message
        const message = await Message.create({
            senderId: currentUserId,
            conversationId,
            content: hasText ? content : '',
            messageType: message_type || messageType || 'text',
            isAnonymous: isAnonymous || false,
            attachments: normalizedAttachments
        });

        await Promise.all([
            redis.del(inboxCacheKey.messages(conversationId, currentUserId)),
            redis.del(inboxCacheKey.messages(conversationId, otherUserId)),
            redis.del(inboxCacheKey.conversations(currentUserId)),
            redis.del(inboxCacheKey.conversations(otherUserId))
        ]);
        
        // Emit real-time message to conversation participants
        const io = global.io;
        if (io) {
            const messagePayload = {
                ...message,
                conversationId: parseInt(conversationId),
                senderId: currentUserId,
                // Ensure field names match frontend expectations
                message_type: message.message_type || message.messageType,
                messageType: message.message_type || message.messageType
            };
            
            // Emit to conversation room only to avoid duplicate delivery for users
            // already subscribed to both conversation and user rooms.
            io.to(`conversation:${conversationId}`).emit('message:received', messagePayload);
            
            // Emit conversation update to update conversation list
            const conversationUpdatePayload = {
                conversationId: parseInt(conversationId),
                participants: [conversation.user1_id, conversation.user2_id],
                senderId: currentUserId,
                last_message: content,
                last_message_at: message.created_at,
                unread_count: 1 // Increment for other user
            };

            io.to(`user:${currentUserId}`).emit('conversation:update', conversationUpdatePayload);
            io.to(`user:${otherUserId}`).emit('conversation:update', conversationUpdatePayload);
            io.to(`conversation:${conversationId}`).emit('conversation:update', conversationUpdatePayload);
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
        
        if (limit === 20 && offset === 0) {
            const cached = await redis.get(inboxCacheKey.messages(conversationId, currentUserId));
            if (cached) {
                return res.status(200).json(cached);
            }
        }

        const conversation = await Conversation.findById(conversationId, currentUserId);
        const otherUserId = conversation.user1_id === currentUserId ? conversation.user2_id : conversation.user1_id;
        const allowed = await canUsersMessage(currentUserId, otherUserId);
        if (!allowed) {
            return res.status(403).json({ message: 'Message request is no longer active' });
        }

        const messages = await Message.getByConversation(
            conversationId, 
            currentUserId,
            limit,
            offset
        );

        if (limit === 20 && offset === 0) {
            await redis.set(inboxCacheKey.messages(conversationId, currentUserId), messages, 20);
        }
        
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

        await Promise.all([
            redis.del(inboxCacheKey.messages(conversationId, currentUserId)),
            redis.del(inboxCacheKey.conversations(currentUserId))
        ]);
        
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

        const targetMessage = await Message.findById ? await Message.findById(messageId) : null;
        if (!targetMessage) {
            return res.status(404).json({ message: 'Message not found' });
        }

        const conversation = await Conversation.findById(targetMessage.conversation_id, currentUserId);
        const otherUserId = conversation.user1_id === currentUserId ? conversation.user2_id : conversation.user1_id;

        const publicIds = extractCloudinaryPublicIds(targetMessage);
        
        await Message.delete(messageId, currentUserId);

        if (publicIds.length > 0) {
            await Promise.allSettled(publicIds.map((publicId) => MediaUploader.deleteMedia(publicId)));
        }

        if (targetMessage?.conversation_id) {
            await Promise.all([
                redis.del(inboxCacheKey.messages(targetMessage.conversation_id, currentUserId)),
                redis.del(inboxCacheKey.messages(targetMessage.conversation_id, otherUserId)),
                redis.del(inboxCacheKey.conversations(currentUserId)),
                redis.del(inboxCacheKey.conversations(otherUserId))
            ]);
        }

        const io = global.io;
        if (io && targetMessage?.conversation_id) {
            const payload = {
                messageId: parseInt(messageId, 10),
                conversationId: targetMessage.conversation_id,
                deletedBy: currentUserId,
                deletedAt: new Date().toISOString(),
            };
            io.to(`conversation:${targetMessage.conversation_id}`).emit('message:deleted', payload);
            io.to(`user:${currentUserId}`).emit('conversation:update', payload);
            io.to(`user:${otherUserId}`).emit('conversation:update', payload);
        }
        
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