const Redis = require('ioredis');
const config = require('../config/config');
const { RateLimiterRedis, RateLimiterMemory } = require('rate-limiter-flexible');
const { logger } = require('../services/loggingService');

// Rate limiting must never take the API down.
// - Redis is only used when caching is enabled for the rest of the app
//   (ENABLE_CACHING=true and a Redis host is configured).
// - Every Redis-backed limiter gets an in-memory "insurance" limiter that
//   transparently takes over when Redis is unreachable.
// - The middleware itself fails open: infrastructure errors let the request
//   through instead of turning into 500 responses on every API call.

const isRateLimitingEnabled = process.env.ENABLE_RATE_LIMITING !== 'false';
const useRedis = process.env.ENABLE_CACHING === 'true' && Boolean(config.redis.host);

let redisClient = null;

if (useRedis) {
  redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    // Managed Redis providers (Upstash, Redis Cloud, Render secure Redis)
    // usually require TLS: set REDIS_TLS=true to enable it.
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: 2,
    connectTimeout: 10000,
    enableReadyCheck: true,
    // Fail fast to the in-memory fallback instead of queueing commands while
    // the connection is down. Prevents multi-second stalls on every API call.
    enableOfflineQueue: false
  });

  // Attach listeners: an unhandled 'error' event would crash the process.
  redisClient.on('error', (err) => {
    logger.error('Rate limiter Redis error:', { message: err.message });
  });
  redisClient.on('connect', () => {
    logger.info('Rate limiter Redis connected');
  });
  redisClient.on('reconnecting', () => {
    logger.warn('Rate limiter Redis reconnecting');
  });
} else {
  logger.info('Rate limiter using in-memory store (Redis disabled or not configured)');
}

const limiterConfigs = {
  // General API requests
  api: { keyPrefix: 'ratelimit:api', points: 100, duration: 60, blockDuration: 60 },
  // Auth requests (login, register, etc.)
  auth: { keyPrefix: 'ratelimit:auth', points: 20, duration: 60 * 60, blockDuration: 60 * 10 },
  // Post creation
  post: { keyPrefix: 'ratelimit:post', points: 30, duration: 60 * 60, blockDuration: 60 * 5 },
  // Comment creation
  comment: { keyPrefix: 'ratelimit:comment', points: 60, duration: 60 * 60, blockDuration: 60 * 5 },
  // Like/unlike actions
  like: { keyPrefix: 'ratelimit:like', points: 100, duration: 60 * 60, blockDuration: 60 * 2 }
};

const createLimiter = (limiterConfig) => {
  const memoryLimiter = new RateLimiterMemory(limiterConfig);

  if (!redisClient) {
    return memoryLimiter;
  }

  return new RateLimiterRedis({
    storeClient: redisClient,
    ...limiterConfig,
    // Transparently fall back to the in-memory limiter when Redis errors.
    insuranceLimiter: memoryLimiter
  });
};

const rateLimiters = Object.fromEntries(
  Object.entries(limiterConfigs).map(([name, limiterConfig]) => [name, createLimiter(limiterConfig)])
);

// Log repeated limiter infrastructure failures at most once per minute.
let lastLimiterErrorLogAt = 0;

// Rate limiter middleware factory
const createRateLimiterMiddleware = (limiterType) => {
  return async (req, res, next) => {
    if (!isRateLimitingEnabled) {
      return next();
    }

    // Skip rate limiting in development mode
    if (process.env.NODE_ENV === 'development' && !config.rateLimiting.enableInDev) {
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
        // Limiter infrastructure failure: fail open instead of breaking the API.
        const now = Date.now();
        if (now - lastLimiterErrorLogAt > 60000) {
          lastLimiterErrorLogAt = now;
          logger.error('Rate limiter unavailable, failing open:', { message: error.message });
        }
        next();
      } else {
        // Rate limit exceeded (RateLimiterRes rejection from rate-limiter-flexible)
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
