const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Map to store user ID to socket ID mappings
const userSocketMap = new Map();

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
        
        // Store user-socket mapping
        const userId = socket.user.id;
        userSocketMap.set(userId, socket.id);
        
        // Join user's personal room
        socket.join(`user:${userId}`);
        
        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
            
            // Remove user-socket mapping
            if (socket.user) {
                userSocketMap.delete(socket.user.id);
            }
        });
    });
    
    return io;
}

// Get socket ID for a user
function getSocketId(userId) {
    return userSocketMap.get(userId);
}

// Emit event to a specific user
function emitToUser(userId, event, data) {
    const io = global.io;
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
}

module.exports = {
    initialize,
    getSocketId,
    emitToUser
};