const Redis = require('ioredis');
const config = require('../config/config');
const { RateLimiterRedis } = require('rate-limiter-flexible');

// Connect to Redis
const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  enableOfflineQueue: false
});

// Configure rate limiters for different types of requests
const rateLimiters = {
  // General API requests
  api: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'ratelimit:api',
    points: 100, // Number of requests
    duration: 60, // Per minute
    blockDuration: 60 // Block for 1 minute if exceeded
  }),
  
  // Auth requests (login, register, etc.)
  auth: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'ratelimit:auth',
    points: 20, // Number of requests
    duration: 60 * 60, // Per hour
    blockDuration: 60 * 10 // Block for 10 minutes if exceeded
  }),
  
  // Post creation
  post: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'ratelimit:post',
    points: 30, // Number of posts
    duration: 60 * 60, // Per hour
    blockDuration: 60 * 5 // Block for 5 minutes if exceeded
  }),
  
  // Comment creation
  comment: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'ratelimit:comment',
    points: 60, // Number of comments
    duration: 60 * 60, // Per hour
    blockDuration: 60 * 5 // Block for 5 minutes if exceeded
  }),
  
  // Like/unlike actions
  like: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'ratelimit:like',
    points: 100, // Number of likes
    duration: 60 * 60, // Per hour
    blockDuration: 60 * 2 // Block for 2 minutes if exceeded
  })
};

// Rate limiter middleware factory
const createRateLimiterMiddleware = (limiterType) => {
  return async (req, res, next) => {
    // Skip rate limiting in development mode
    if (process.env.NODE_ENV === 'development' && !config.enableRateLimitingInDev) {
      return next();
    }
    
    const limiter = rateLimiters[limiterType] || rateLimiters.api;
    
    // Get IP and/or user ID for rate limiting key
    let key = req.ip;
    
    // If user is authenticated, use user ID in the key
    if (req.user) {
      key = `${key}:${req.user.id}`;
    }
    
    try {
      const rateLimitResult = await limiter.consume(key);
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': limiter.points,
        'X-RateLimit-Remaining': rateLimitResult.remainingPoints,
        'X-RateLimit-Reset': new Date(Date.now() + rateLimitResult.msBeforeNext)
      });
      
      next();
    } catch (error) {
      if (error instanceof Error) {
        // Some other error occurred
        console.error('Rate limiter error:', error);
        next(error);
      } else {
        // Rate limit exceeded
        res.set({
          'Retry-After': Math.ceil(error.msBeforeNext / 1000),
          'X-RateLimit-Limit': limiter.points,
          'X-RateLimit-Remaining': 0,
          'X-RateLimit-Reset': new Date(Date.now() + error.msBeforeNext)
        });
        
        res.status(429).json({
          message: 'Too many requests, please try again later.',
          retryAfter: Math.ceil(error.msBeforeNext / 1000)
        });
      }
    }
  };
};

// Middleware for different API endpoints
const apiLimiter = createRateLimiterMiddleware('api');
const authLimiter = createRateLimiterMiddleware('auth');
const postLimiter = createRateLimiterMiddleware('post');
const commentLimiter = createRateLimiterMiddleware('comment');
const likeLimiter = createRateLimiterMiddleware('like');

module.exports = {
  apiLimiter,
  authLimiter,
  postLimiter,
  commentLimiter,
  likeLimiter,
  createRateLimiterMiddleware
};