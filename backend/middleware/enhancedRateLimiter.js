const Redis = require('ioredis');
const config = require('../config/config');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const { logger } = require('../services/loggingService');

// Connect to Redis with error handling
const redisClient = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    const delay = Math.min(times * 500, 30000);
    return delay;
  }
});

// Fallback to memory if Redis is unavailable
let isRedisAvailable = true;
const memoryRateLimiters = new Map();

redisClient.on('error', (err) => {
  if (isRedisAvailable) {
    logger.error('Redis rate limiter error, falling back to memory:', err);
    isRedisAvailable = false;
  }
});

redisClient.on('connect', () => {
  if (!isRedisAvailable) {
    logger.info('Redis rate limiter reconnected');
    isRedisAvailable = true;
  }
});

// Configure rate limiters
const rateLimiters = {
  // Login attempts - more strict
  login: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'ratelimit:login',
    points: 5, // 5 attempts
    duration: 60 * 15, // per 15 minutes
    blockDuration: 60 * 30, // Block for 30 minutes if exceeded
  }),
  
  // Password reset attempts
  passwordReset: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'ratelimit:passwordreset',
    points: 3, // 3 attempts
    duration: 60 * 60, // per hour
    blockDuration: 60 * 60, // Block for 1 hour if exceeded
  }),
  
  // Registration attempts
  registration: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'ratelimit:registration',
    points: 3, // 3 registrations
    duration: 60 * 60 * 24, // per day
    blockDuration: 60 * 60 * 12, // Block for 12 hours if exceeded
  })
};

// Get appropriate rate limiter
const getRateLimiter = (type) => {
  if (!isRedisAvailable) {
    // Use in-memory fallback
    if (!memoryRateLimiters.has(type)) {
      const { RateLimiterMemory } = require('rate-limiter-flexible');
      const options = {
        points: rateLimiters[type].points,
        duration: rateLimiters[type].duration,
      };
      memoryRateLimiters.set(type, new RateLimiterMemory(options));
    }
    return memoryRateLimiters.get(type);
  }
  
  return rateLimiters[type];
};

// Enhanced login rate limiter middleware
const loginRateLimiter = async (req, res, next) => {
  if (process.env.NODE_ENV === 'development' && !config.rateLimiting.enableInDev) {
    return next();
  }
  
  const ip = req.ip;
  const username = req.body.username || req.body.email || 'unknown';
  
  // Combine IP and username for better protection
  const key = `${ip}:${username.toLowerCase()}`;
  
  try {
    const limiter = getRateLimiter('login');
    await limiter.consume(key);
    next();
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Rate limiter error:', error);
      next(error);
    } else {
      // Log failed login attempt
      logger.warn('Login rate limit exceeded', { ip, username });
      
      // Get retry time
      const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 1800;
      
      res.set('Retry-After', retryAfter);
      res.status(429).json({
        message: 'Too many login attempts, please try again later',
        retryAfter
      });
    }
  }
};

// Password reset rate limiter
const passwordResetRateLimiter = async (req, res, next) => {
  if (process.env.NODE_ENV === 'development' && !config.rateLimiting.enableInDev) {
    return next();
  }
  
  const ip = req.ip;
  const email = req.body.email || 'unknown';
  
  // Combine IP and email
  const key = `${ip}:${email.toLowerCase()}`;
  
  try {
    const limiter = getRateLimiter('passwordReset');
    await limiter.consume(key);
    next();
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Rate limiter error:', error);
      next(error);
    } else {
      // Log failed password reset attempt
      logger.warn('Password reset rate limit exceeded', { ip, email });
      
      // Get retry time
      const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 3600;
      
      res.set('Retry-After', retryAfter);
      res.status(429).json({
        message: 'Too many password reset attempts, please try again later',
        retryAfter
      });
    }
  }
};

// Registration rate limiter
const registrationRateLimiter = async (req, res, next) => {
  if (process.env.NODE_ENV === 'development' && !config.rateLimiting.enableInDev) {
    return next();
  }
  
  const ip = req.ip;
  
  try {
    const limiter = getRateLimiter('registration');
    await limiter.consume(ip);
    next();
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Rate limiter error:', error);
      next(error);
    } else {
      // Log failed registration attempt
      logger.warn('Registration rate limit exceeded', { ip });
      
      // Get retry time
      const retryAfter = Math.ceil(error.msBeforeNext / 1000) || 43200;
      
      res.set('Retry-After', retryAfter);
      res.status(429).json({
        message: 'Registration limit reached, please try again later',
        retryAfter
      });
    }
  }
};

module.exports = {
  loginRateLimiter,
  passwordResetRateLimiter,
  registrationRateLimiter
};