const express = require('express');
const http = require('http');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const Sentry = require('@sentry/node');
require('./config/loadEnv');
const db = require('./config/database');

// Import routes
const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const likeRoutes = require('./routes/likeRoutes');
const commentRoutes = require('./routes/commentRoutes');
const requestRoutes = require('./routes/requestRoutes');
const groupRoutes = require('./routes/groupRoutes');
const inboxRoutes = require('./routes/inboxRoutes');
const socketManager = require('./utils/socketManager');
const notificationRoutes = require('./routes/notificationRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const searchRoutes = require('./routes/searchRoutes');
const reportRoutes = require('./routes/reportRoutes');
const moderationRoutes = require('./routes/moderationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const gamificationRoutes = require('./routes/gamificationRoutes');
const { setupSwagger } = require('./config/swagger');
const { router: metricsRouter, metricsMiddleware, errorMetricsMiddleware } = require('./routes/metricsRoutes');
const { requestLogger } = require('./middleware/logging');
const { apiLimiter, authLimiter, postLimiter, commentLimiter, likeLimiter } = require('./middleware/rateLimiter');
const { selectiveCsrf, handleCsrfError } = require('./middleware/csrf');
const { initQueryMonitoring } = require('./services/queryMonitoringService');
const circuitBreakerService = require('./services/circuitBreakerService');
const { authenticateToken, isAdmin } = require('./middleware/auth');

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


const sentryDsn = process.env.SENTRY_DSN;
const sentryEnabled = Boolean(sentryDsn);

if (sentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    integrations: [
      Sentry.httpIntegration(),
      Sentry.expressIntegration()
    ]
  });
}



const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const err = new Error('Origin is not allowed by CORS policy');
    err.statusCode = 403;
    return callback(err);
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
};

const io = socketManager.initialize(server);
global.io = io;

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https:', 'wss:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware);
app.use(selectiveCsrf);
app.use(handleCsrfError);
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api', (req, res, next) => {
  const writeMethod = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE';
  if (!writeMethod) {
    return next();
  }

  const path = req.path || '';

  if (path.startsWith('/posts') && path.includes('/comments')) {
    return commentLimiter(req, res, next);
  }

  if (path.startsWith('/posts')) {
    return postLimiter(req, res, next);
  }

  if (path.includes('/like')) {
    return likeLimiter(req, res, next);
  }

  return next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api', likeRoutes); // Note: this will use paths like /api/posts/:id/like
app.use('/api', commentRoutes); // Note: this will use paths like /api/posts/:id/comments
app.use('/api/requests', requestRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/gamification', gamificationRoutes);


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

if (sentryEnabled) {
  Sentry.setupExpressErrorHandler(app);
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown'
  });
});

app.get('/ready', async (req, res) => {
  try {
    const dbCheck = await db.query('SELECT 1');
    let redisHealthy = true;
    if (process.env.ENABLE_CACHING === 'true') {
      try {
        const { healthCheck } = require('./services/enhancedRedisService');
        const redisStatus = await healthCheck();
        redisHealthy = redisStatus.status === 'healthy';
      } catch (e) {
        console.warn('Redis health check failed:', e.message);
        redisHealthy = false;
      }
    }
    res.json({
      ready: true,
      timestamp: new Date(),
      database: { connected: !!dbCheck },
      cache: { enabled: process.env.ENABLE_CACHING === 'true', healthy: redisHealthy }
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date()
    });
  }
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

  if (sentryEnabled) {
    Sentry.captureException(err, {
      user: req.user ? { id: req.user.id } : undefined,
      tags: {
        path: req.path,
        method: req.method
      }
    });
  }
  
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



server.listen(PORT, () => {
    console.log(`🚀 Gossip Server running at http://localhost:${PORT}`);
});

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} signal received: closing HTTP server...`);
    
    server.close(async () => {
        console.log('HTTP server closed');
        
        try {
            await db.pool.end();
            console.log('Database connections closed');
        } catch (error) {
            console.error('Error closing database:', error);
        }
        
        console.log('Graceful shutdown completed');
        process.exit(0);
    });
    
    setTimeout(() => {
        console.error('Forced shutdown after 30s timeout');
        process.exit(1);
    }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));