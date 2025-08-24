const { logRequest, logActivity } = require('../services/loggingService');

// Middleware to log request information
const requestLogger = (req, res, next) => {
  // Record start time
  const start = Date.now();
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function
  res.end = function(...args) {
    // Calculate response time
    const responseTime = Date.now() - start;
    
    // Log the request
    logRequest(req, res, responseTime);
    
    // Call original end function
    return originalEnd.apply(this, args);
  };
  
  next();
};

// Middleware to log user activity
const activityLogger = (action, entityType, getEntityId = req => req.params.id) => {
  return (req, res, next) => {
    // Only log for authenticated users
    if (!req.user) {
      return next();
    }
    
    // Store original end function
    const originalEnd = res.end;
    
    // Override end function
    res.end = function(...args) {
      // Only log for successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Get entity ID (from function or params)
        let entityId;
        
        if (typeof getEntityId === 'function') {
          entityId = getEntityId(req);
        } else {
          entityId = req.params[getEntityId];
        }
        
        // Log the activity
        logActivity(
          req.user.id,
          action,
          entityType,
          entityId,
          { method: req.method, path: req.originalUrl }
        );
      }
      
      // Call original end function
      return originalEnd.apply(this, args);
    };
    
    next();
  };
};

module.exports = {
  requestLogger,
  activityLogger
};