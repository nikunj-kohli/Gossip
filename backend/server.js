const express = require('express');
const http = require('http');
const cors = require('cors');
const db = require('./config/database');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const likeRoutes = require('./routes/likeRoutes');
const commentRoutes = require('./routes/commentRoutes');
const friendshipRoutes = require('./routes/friendshipRoutes');
const groupRoutes = require('./routes/groupRoutes');
const messageRoutes = require('./routes/messageRoutes');
const socketManager = require('./utils/socketManager');
const notificationRoutes = require('./routes/notificationRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const searchRoutes = require('./routes/searchRoutes');
const { trackPostView } = require('./middleware/postViewTracker');
const reportRoutes = require('./routes/reportRoutes');
const moderationRoutes = require('./routes/moderationRoutes');



const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const io = socketManager.initialize(server);
global.io = io;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api', likeRoutes); // Note: this will use paths like /api/posts/:id/like
app.use('/api', commentRoutes); // Note: this will use paths like /api/posts/:id/comments
app.use('/api/friends', friendshipRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/conversations', messageRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/posts/:postId', trackPostView);
app.use('/api/reports', reportRoutes);
app.use('/api/moderation', moderationRoutes);


// Test routes
app.get('/api/test', (req, res) => {
    res.json({ message: 'Gossip API is working!' });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({
            message: 'Database connected successfully',
            timestamp: result.rows[0].now
        });
    } catch (error) {
        res.status(500).json({
            message: 'Database connection failed',
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Gossip Server running at http://localhost:${PORT}`);
    console.log(`📡 API Test: http://localhost:${PORT}/api/test`);
    console.log(`💾 Database Test: http://localhost:${PORT}/api/test-db`);
});