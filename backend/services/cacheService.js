const Redis = require('ioredis');
const config = require('../config/config');

// Cache layer for response caching (used by middleware/cache.js).
// Follows the same resilience rules as the rest of the app:
// - The Redis client is only created when caching is actually enabled
//   (ENABLE_CACHING=true and a Redis host is configured).
// - The client has error listeners so a dead Redis never crashes the process
//   or floods logs with "Unhandled error event" spam.
// - Offline queue is disabled so callers fail fast instead of stalling for
//   seconds while Redis is unreachable.
// - Every operation degrades gracefully (returns null/false) on failure.

const isCachingEnabled = process.env.ENABLE_CACHING === 'true' && Boolean(config.redis.host);

let redisClient = null;

if (isCachingEnabled) {
  redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    // Managed Redis providers usually require TLS: set REDIS_TLS=true.
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    maxRetriesPerRequest: 2,
    connectTimeout: 10000,
    enableReadyCheck: true,
    // Fail fast to the graceful-degradation path instead of queueing commands
    // while the connection is down.
    enableOfflineQueue: false
  });

  redisClient.on('error', (err) => {
    console.error('Cache Redis error:', err.message);
  });
  redisClient.on('connect', () => {
    console.log('Cache Redis connected');
  });
  redisClient.on('reconnecting', () => {
    console.warn('Cache Redis reconnecting');
  });
} else {
  console.log('Cache service using no-op mode (Redis disabled or not configured)');
}

// Default expiration time (1 hour)
const DEFAULT_EXPIRATION = 60 * 60;

// Set a value in cache
const set = async (key, value, expiration = DEFAULT_EXPIRATION) => {
  if (!redisClient) return true; // no-op when caching is disabled

  try {
    // If value is an object, stringify it
    const valueToStore = typeof value === 'object' ? JSON.stringify(value) : value;

    // Set with expiration
    await redisClient.set(key, valueToStore, 'EX', expiration);

    return true;
  } catch (error) {
    console.error('Cache set error:', error.message);
    return false;
  }
};

// Get a value from cache
const get = async (key) => {
  if (!redisClient) return null; // no-op when caching is disabled

  try {
    const value = await redisClient.get(key);

    if (!value) return null;

    // Try to parse as JSON, return as is if not valid JSON
    try {
      return JSON.parse(value);
    } catch (e) {
      return value;
    }
  } catch (error) {
    console.error('Cache get error:', error.message);
    return null;
  }
};

// Delete a value from cache
const del = async (key) => {
  if (!redisClient) return true; // no-op when caching is disabled

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error.message);
    return false;
  }
};

// Delete multiple values by pattern
const delByPattern = async (pattern) => {
  if (!redisClient) return 0; // no-op when caching is disabled

  try {
    // Get all keys matching pattern
    const keys = await redisClient.keys(pattern);

    if (keys.length > 0) {
      // Delete all matching keys
      await redisClient.del(...keys);
    }

    return keys.length;
  } catch (error) {
    console.error('Cache delete by pattern error:', error.message);
    return 0;
  }
};

// Clear all cache
const clear = async () => {
  if (!redisClient) return true; // no-op when caching is disabled

  try {
    await redisClient.flushdb();
    return true;
  } catch (error) {
    console.error('Cache clear error:', error.message);
    return false;
  }
};

// Get multiple values
const mget = async (keys) => {
  if (!redisClient) return keys.map(() => null); // no-op when caching is disabled

  try {
    const values = await redisClient.mget(keys);

    // Parse each value as JSON if possible
    return values.map(value => {
      if (!value) return null;

      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    });
  } catch (error) {
    console.error('Cache mget error:', error.message);
    return keys.map(() => null);
  }
};

// Set multiple values
const mset = async (keyValues, expiration = DEFAULT_EXPIRATION) => {
  if (!redisClient) return true; // no-op when caching is disabled

  try {
    // Prepare args for mset
    const args = [];

    // Convert objects to strings
    for (const [key, value] of Object.entries(keyValues)) {
      args.push(key);
      args.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }

    // Set multiple values
    await redisClient.mset(...args);

    // Set expiration for each key
    const expirationPromises = Object.keys(keyValues).map(key =>
      redisClient.expire(key, expiration)
    );

    await Promise.all(expirationPromises);

    return true;
  } catch (error) {
    console.error('Cache mset error:', error.message);
    return false;
  }
};

// Cache wrapper for functions
const wrap = async (key, fn, expiration = DEFAULT_EXPIRATION) => {
  try {
    // Try to get from cache first
    const cachedValue = await get(key);

    if (cachedValue !== null) {
      return cachedValue;
    }

    // If not in cache, call the function
    const result = await fn();

    // Store in cache
    await set(key, result, expiration);

    return result;
  } catch (error) {
    console.error('Cache wrap error:', error.message);
    // If cache fails, just call the function
    return fn();
  }
};

// Increment a counter
const increment = async (key, value = 1, expiration = DEFAULT_EXPIRATION) => {
  if (!redisClient) return null; // no-op when caching is disabled

  try {
    const result = await redisClient.incrby(key, value);

    // Set expiration if it's a new key
    if (result === value) {
      await redisClient.expire(key, expiration);
    }

    return result;
  } catch (error) {
    console.error('Cache increment error:', error.message);
    return null;
  }
};

// Decrement a counter
const decrement = async (key, value = 1) => {
  if (!redisClient) return null; // no-op when caching is disabled

  try {
    return await redisClient.decrby(key, value);
  } catch (error) {
    console.error('Cache decrement error:', error.message);
    return null;
  }
};

module.exports = {
  set,
  get,
  del,
  delByPattern,
  clear,
  mget,
  mset,
  wrap,
  increment,
  decrement,
  redisClient
};
