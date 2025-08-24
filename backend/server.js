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
const chatRoutes = require('./routes/chatRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');
const { setupSwagger } = require('./config/swagger');
const { router: metricsRouter, metricsMiddleware, errorMetricsMiddleware } = require('./routes/metricsRoutes');
const { requestLogger } = require('./middleware/logging');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const { selectiveCsrf, handleCsrfError } = require('./middleware/csrf');
const { loginRateLimiter, passwordResetRateLimiter, registrationRateLimiter } = require('./middleware/enhancedRateLimiter');
const { initQueryMonitoring } = require('./services/queryMonitoringService');
const circuitBreakerService = require('./services/circuitBreakerService');

const initializeServices = async () => {
  try {
    // Initialize query monitoring
    await initQueryMonitoring();
    
    // Initialize other services as needed
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Error initializing services:', error);
    // Continue anyway to avoid startup failure
  }
};


initializeServices().catch(console.error);



const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const io = socketManager.initialize(server);
global.io = io;

app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(selectiveCsrf);
app.use(handleCsrfError);

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
app.use('/api/chat', chatRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/', apiLimiter);
app.use('/api/auth', authLimiter);


app.use(async (req, res, next) => {
  // If user is authenticated, track actions that deserve points
  if (req.user) {
    const originalSend = res.send;
    
    res.send = function(body) {
      // Only process for successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const url = req.originalUrl;
          const method = req.method;
          
          // Check for specific actions that deserve points
          if (method === 'POST' && url.match(/\/api\/posts\/?$/)) {
            // User created a post
            const GamificationService = require('./services/gamificationService');
            GamificationService.awardPoints(req.user.id, 'post_create', JSON.parse(body).id)
              .catch(err => console.error('Error awarding points for post creation:', err));
          }
          else if (method === 'POST' && url.match(/\/api\/comments\/?$/)) {
            // User created a comment
            const GamificationService = require('./services/gamificationService');
            GamificationService.awardPoints(req.user.id, 'comment_create', JSON.parse(body).id)
              .catch(err => console.error('Error awarding points for comment creation:', err));
          }
          // Add other actions here
        } catch (error) {
          console.error('Error in gamification middleware:', error);
        }
      }
      
      originalSend.apply(res, arguments);
    };
  }
  
  next();
});

setupSwagger(app);

app.use('/api', metricsRouter);
app.use(errorMetricsMiddleware);

const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const { postLimiter, commentLimiter, likeLimiter } = require('./middleware/rateLimiter');

app.use('/api/posts', postLimiter, postRoutes);
app.use('/api/comments', commentLimiter, commentRoutes);

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

app.post('/api/auth/login', loginRateLimiter);
app.post('/api/auth/register', registrationRateLimiter);
app.post('/api/auth/forgot-password', passwordResetRateLimiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown'
  });
});



app.get('/api/admin/circuit-breakers', authenticateToken, isAdmin, (req, res) => {
  const statuses = Object.keys(circuitBreakerService.getBreakerStatus('all'));
  res.json(statuses);
});


app.get('/api/admin/slow-queries', authenticateToken, isAdmin, async (req, res) => {
  const { getSlowQueryReport } = require('./services/queryMonitoringService');
  const threshold = parseInt(req.query.threshold) || 200;
  const limit = parseInt(req.query.limit) || 100;
  
  const report = await getSlowQueryReport(threshold, limit);
  res.json(report);
});

// Enhanced global error handler (replace existing error handler or add if none exists)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  
  // Log the error
  console.error(`[${new Date().toISOString()}] Error:`, {
    path: req.path,
    method: req.method,
    statusCode,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    userId: req.user?.id,
    ip: req.ip
  });
  
  // Send appropriate response
  res.status(statusCode).json({
    error: {
      message: statusCode === 500 && process.env.NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : err.message,
      code: err.code || 'SERVER_ERROR'
    }
  });
});



app.listen(PORT, () => {
    console.log(`🚀 Gossip Server running at http://localhost:${PORT}`);
    console.log(`📡 API Test: http://localhost:${PORT}/api/test`);
    console.log(`💾 Database Test: http://localhost:${PORT}/api/test-db`);
});