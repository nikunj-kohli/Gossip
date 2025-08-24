const express = require('express');
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

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api', likeRoutes); // Note: this will use paths like /api/posts/:id/like
app.use('/api', commentRoutes); // Note: this will use paths like /api/posts/:id/comments
app.use('/api/friends', friendshipRoutes);
app.use('/api/groups', groupRoutes);

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