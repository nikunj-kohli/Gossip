const cacheService = require('../services/cacheService');

// Middleware to cache API responses
const cacheMiddleware = (duration = 60 * 5) => { // Default 5 minutes
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Skip caching for authenticated requests that return user-specific data
    // unless explicitly allowed
    if (req.user && !req.allowCache) {
      return next();
    }
    
    // Generate cache key based on URL and query params
    const cacheKey = `cache:${req.originalUrl}`;
    
    try {
      // Try to get from cache
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        // Set cache header
        res.set('X-Cache', 'HIT');
        return res.json(cachedResponse);
      }
      
      // Cache miss, continue to handler
      res.set('X-Cache', 'MISS');
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, data, duration)
            .catch(err => console.error('Error caching response:', err));
        }
        
        // Call original method
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next();
    }
  };
};

// Middleware to bust cache for specific patterns
const cacheBustMiddleware = (patterns) => {
  return async (req, res, next) => {
    // Skip for GET requests
    if (req.method === 'GET') {
      return next();
    }
    
    // Original end method
    const originalEnd = res.end;
    
    // Override end method to clear cache after successful requests
    res.end = async function(...args) {
      // Only bust cache for successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          for (const pattern of patterns) {
            await cacheService.delByPattern(pattern);
          }
        } catch (error) {
          console.error('Cache bust error:', error);
        }
      }
      
      // Call original method
      return originalEnd.apply(this, args);
    };
    
    next();
  };
};

// Middleware for user-specific caching
const userCacheMiddleware = (duration = 60 * 5) => {
  return async (req, res, next) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Ensure user is authenticated
    if (!req.user) {
      return next();
    }
    
    // Generate cache key based on URL, query params, and user ID
    const cacheKey = `cache:user:${req.user.id}:${req.originalUrl}`;
    
    try {
      // Try to get from cache
      const cachedResponse = await cacheService.get(cacheKey);
      
      if (cachedResponse) {
        // Set cache header
        res.set('X-Cache', 'HIT');
        return res.json(cachedResponse);
      }
      
      // Cache miss, continue to handler
      res.set('X-Cache', 'MISS');
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, data, duration)
            .catch(err => console.error('Error caching response:', err));
        }
        
        // Call original method
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      console.error('User cache middleware error:', error);
      next();
    }
  };
};

// Middleware to bust user-specific cache
const userCacheBustMiddleware = (userId, patterns) => {
  return async (req, res, next) => {
    // Original end method
    const originalEnd = res.end;
    
    // Override end method to clear cache after successful requests
    res.end = async function(...args) {
      // Only bust cache for successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          for (const pattern of patterns) {
            await cacheService.delByPattern(`cache:user:${userId}:${pattern}`);
          }
        } catch (error) {
          console.error('User cache bust error:', error);
        }
      }
      
      // Call original method
      return originalEnd.apply(this, args);
    };
    
    next();
  };
};

module.exports = {
  cacheMiddleware,
  cacheBustMiddleware,
  userCacheMiddleware,
  userCacheBustMiddleware
};