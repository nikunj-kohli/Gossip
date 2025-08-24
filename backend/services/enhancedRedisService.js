const Redis = require('ioredis');
const config = require('../config/config');
const { logger } = require('./loggingService');
const { executeWithBreaker } = require('./circuitBreakerService');

// Create Redis client with reconnection logic
const createRedisClient = () => {
  const client = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    retryStrategy: (times) => {
      // Exponential backoff with max 30 seconds
      const delay = Math.min(times * 500, 30000);
      logger.info(`Redis reconnection attempt in ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.on('error', (error) => {
    logger.error('Redis client error:', error);
  });

  client.on('reconnecting', (delay) => {
    logger.warn(`Redis client reconnecting in ${delay}ms`);
  });

  return client;
};

// Create Redis client
const redisClient = createRedisClient();

// In-memory fallback cache
const memoryCache = new Map();

// Set a value with circuit breaker
const set = async (key, value, expiration = 3600) => {
  const valueToStore = typeof value === 'object' ? JSON.stringify(value) : value;
  
  return executeWithBreaker(
    'redis-set',
    async () => {
      await redisClient.set(key, valueToStore, 'EX', expiration);
      // Also update memory cache
      memoryCache.set(key, {
        value: valueToStore,
        expires: Date.now() + (expiration * 1000)
      });
      return true;
    },
    async () => {
      // Fallback: Store in memory cache
      memoryCache.set(key, {
        value: valueToStore,
        expires: Date.now() + (expiration * 1000)
      });
      return true;
    }
  );
};

// Get a value with circuit breaker
const get = async (key) => {
  return executeWithBreaker(
    'redis-get',
    async () => {
      const value = await redisClient.get(key);
      if (!value) return null;
      
      // Try to parse as JSON, return as is if not valid JSON
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    },
    async () => {
      // Fallback: Try memory cache
      const cached = memoryCache.get(key);
      if (!cached) return null;
      
      // Check if expired
      if (cached.expires < Date.now()) {
        memoryCache.delete(key);
        return null;
      }
      
      // Return value (parse if needed)
      try {
        return JSON.parse(cached.value);
      } catch (e) {
        return cached.value;
      }
    }
  );
};

// Delete a value with circuit breaker
const del = async (key) => {
  return executeWithBreaker(
    'redis-del',
    async () => {
      await redisClient.del(key);
      // Also remove from memory cache
      memoryCache.delete(key);
      return true;
    },
    async () => {
      // Fallback: Remove from memory cache
      memoryCache.delete(key);
      return true;
    }
  );
};

// Check health of Redis
const healthCheck = async () => {
  try {
    const result = await redisClient.ping();
    return result === 'PONG';
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
};

module.exports = {
  redisClient,
  set,
  get,
  del,
  healthCheck
};