const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Maps to store user data and connections
const userSocketMap = new Map(); // userId -> Set of socketIds
const socketUserMap = new Map(); // socketId -> userId
const userStatusMap = new Map(); // userId -> status object
const typingUsers = new Map(); // channelId -> Set of typing userIds

// Initialize socket.io
function initialize(server) {
  const io = socketIO(server, {
    cors: {
      origin: config.clientUrl,
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  
  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });
  
  // Connection handler
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);
    
    // Store user-socket mapping (multiple sockets per user supported)
    const userId = socket.user.id;
    
    // Add socket to user's set of sockets
    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId).add(socket.id);
    
    // Store reverse mapping
    socketUserMap.set(socket.id, userId);
    
    // Join user's personal room
    socket.join(`user:${userId}`);
    
    // Set initial online status
    updateUserStatus(userId, 'online');
    broadcastUserStatus(userId, 'online');
    
    // Join conversations (can be called later as well)
    socket.on('join:conversations', async (conversationIds) => {
      if (Array.isArray(conversationIds)) {
        conversationIds.forEach(id => {
          socket.join(`conversation:${id}`);
        });
      }
    });
    
    // Join groups (can be called later as well)
    socket.on('join:groups', async (groupIds) => {
      if (Array.isArray(groupIds)) {
        groupIds.forEach(id => {
          socket.join(`group:${id}`);
        });
      }
    });
    
    // Handle chat messages
    socket.on('message:send', async (data) => {
      try {
        // This would be handled by a chat controller
        // Here we just emit back to the appropriate room
        if (data.conversationId) {
          io.to(`conversation:${data.conversationId}`).emit('message:received', {
            ...data,
            sender: {
              id: userId,
              username: socket.user.username,
              displayName: socket.user.displayName,
              avatarUrl: socket.user.avatarUrl
            },
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error handling message:', error);
        socket.emit('error', { message: 'Error sending message' });
      }
    });
    
    // Handle typing indicators
    socket.on('typing:start', (data) => {
      const { channelId, channelType } = data;
      const roomId = `${channelType}:${channelId}`;
      
      // Add user to typing users for this channel
      if (!typingUsers.has(roomId)) {
        typingUsers.set(roomId, new Set());
      }
      typingUsers.get(roomId).add(userId);
      
      // Broadcast to others in the room
      socket.to(roomId).emit('typing:update', {
        channelId,
        channelType,
        users: Array.from(typingUsers.get(roomId)).map(id => ({
          id,
          username: id === userId ? socket.user.username : undefined // We'd need to fetch other usernames
        }))
      });
    });
    
    // Handle typing stopped
    socket.on('typing:stop', (data) => {
      const { channelId, channelType } = data;
      const roomId = `${channelType}:${channelId}`;
      
      // Remove user from typing users
      if (typingUsers.has(roomId)) {
        typingUsers.get(roomId).delete(userId);
        
        // Broadcast updated typing users
        io.to(roomId).emit('typing:update', {
          channelId,
          channelType,
          users: Array.from(typingUsers.get(roomId)).map(id => ({
            id,
            username: id === userId ? socket.user.username : undefined
          }))
        });
      }
    });
    
    // Handle manual status changes
    socket.on('status:update', (status) => {
      const validStatuses = ['online', 'away', 'busy', 'offline'];
      if (validStatuses.includes(status)) {
        updateUserStatus(userId, status);
        broadcastUserStatus(userId, status);
      }
    });
    
    // Handle presence heartbeat
    socket.on('presence:heartbeat', () => {
      if (userStatusMap.has(userId)) {
        const statusObj = userStatusMap.get(userId);
        statusObj.lastActivity = Date.now();
        if (statusObj.status === 'away') {
          updateUserStatus(userId, 'online');
          broadcastUserStatus(userId, 'online');
        }
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Remove socket from user's set
      if (userSocketMap.has(userId)) {
        userSocketMap.get(userId).delete(socket.id);
        
        // If this was the user's last socket, update status to offline
        if (userSocketMap.get(userId).size === 0) {
          userSocketMap.delete(userId);
          updateUserStatus(userId, 'offline');
          broadcastUserStatus(userId, 'offline');
        }
      }
      
      // Remove from reverse mapping
      socketUserMap.delete(socket.id);
      
      // Remove from all typing indicators
      typingUsers.forEach((users, roomId) => {
        if (users.has(userId)) {
          users.delete(userId);
          io.to(roomId).emit('typing:update', {
            channelId: roomId.split(':')[1],
            channelType: roomId.split(':')[0],
            users: Array.from(users).map(id => ({ id }))
          });
        }
      });
    });
  });
  
  // Set up periodic check for idle users
  setInterval(() => {
    const idleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    
    userStatusMap.forEach((statusObj, userId) => {
      if (statusObj.status === 'online' && (now - statusObj.lastActivity) > idleThreshold) {
        updateUserStatus(userId, 'away');
        broadcastUserStatus(userId, 'away');
      }
    });
  }, 60000); // Check every minute
  
  return io;
}

// Update user status in the status map
function updateUserStatus(userId, status) {
  userStatusMap.set(userId, {
    status,
    lastActivity: Date.now()
  });
}

// Broadcast user status change to friends
async function broadcastUserStatus(userId, status) {
  try {
    const io = global.io;
    if (!io) return;
    
    // First, broadcast to the user themselves
    io.to(`user:${userId}`).emit('status:update', {
      userId,
      status
    });
    
    // We'd normally fetch this user's friends from the database
    // For now, we'll emit to all users
    io.emit('friend:status', {
      userId,
      status
    });
    
    // In a real implementation, you would:
    // 1. Get the user's friends from the database
    // 2. Emit only to those friends
    // const db = require('../config/database');
    // const friendsQuery = `
    //   SELECT 
    //     CASE 
    //       WHEN requester_id = $1 THEN addressee_id 
    //       ELSE requester_id 
    //     END as friend_id
    //   FROM friendships
    //   WHERE (requester_id = $1 OR addressee_id = $1)
    //   AND status = 'accepted'
    // `;
    // const friendsResult = await db.query(friendsQuery, [userId]);
    // const friendIds = friendsResult.rows.map(row => row.friend_id);
    
    // friendIds.forEach(friendId => {
    //   io.to(`user:${friendId}`).emit('friend:status', {
    //     userId,
    //     status
    //   });
    // });
  } catch (error) {
    console.error('Error broadcasting status:', error);
  }
}

// Get all socket IDs for a user
function getSocketIds(userId) {
  if (userSocketMap.has(userId)) {
    return Array.from(userSocketMap.get(userId));
  }
  return [];
}

// Check if user is online
function isUserOnline(userId) {
  if (userStatusMap.has(userId)) {
    const status = userStatusMap.get(userId).status;
    return status === 'online' || status === 'away' || status === 'busy';
  }
  return false;
}

// Get user status
function getUserStatus(userId) {
  if (userStatusMap.has(userId)) {
    return userStatusMap.get(userId).status;
  }
  return 'offline';
}

// Get online users
function getOnlineUsers() {
  const onlineUsers = [];
  userStatusMap.forEach((statusObj, userId) => {
    if (statusObj.status !== 'offline') {
      onlineUsers.push({
        userId,
        status: statusObj.status
      });
    }
  });
  return onlineUsers;
}

// Emit event to a specific user (all their connected sockets)
function emitToUser(userId, event, data) {
  const io = global.io;
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

// Emit event to a conversation
function emitToConversation(conversationId, event, data) {
  const io = global.io;
  if (io) {
    io.to(`conversation:${conversationId}`).emit(event, data);
  }
}

// Emit event to a group
function emitToGroup(groupId, event, data) {
  const io = global.io;
  if (io) {
    io.to(`group:${groupId}`).emit(event, data);
  }
}

module.exports = {
  initialize,
  getSocketIds,
  isUserOnline,
  getUserStatus,
  getOnlineUsers,
  emitToUser,
  emitToConversation,
  emitToGroup
};