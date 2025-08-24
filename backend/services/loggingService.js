const winston = require('winston');
const { format } = winston;
const config = require('../config/config');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Define custom log format
const customFormat = format.combine(
  format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  format.errors({ stack: true }),
  format.splat(),
  format.json()
);

// Create winston logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: customFormat,
  defaultMeta: { service: 'gossip-api' },
  transports: [
    // Write logs to console
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, ...meta }) => {
          return `[${timestamp}] ${level}: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      )
    }),
    
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    
    // Write all error logs to error.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  ]
});

// Create logger for API requests
const createRequestLogger = () => {
  const requestLogger = winston.createLogger({
    level: 'info',
    format: customFormat,
    defaultMeta: { service: 'gossip-api-requests' },
    transports: [
      // Write to requests.log
      new winston.transports.File({ 
        filename: path.join(logsDir, 'requests.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    ]
  });
  
  // Add console transport in development
  if (process.env.NODE_ENV !== 'production') {
    requestLogger.add(new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, method, path, status, responseTime, userId, ip, ...meta }) => {
          return `[${timestamp}] ${level}: ${method} ${path} ${status} ${responseTime}ms ${userId ? `User: ${userId}` : `IP: ${ip}`} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      )
    }));
  }
  
  return requestLogger;
};

const requestLogger = createRequestLogger();

// Log user activity
const createActivityLogger = () => {
  const activityLogger = winston.createLogger({
    level: 'info',
    format: customFormat,
    defaultMeta: { service: 'gossip-user-activity' },
    transports: [
      // Write to activity.log
      new winston.transports.File({ 
        filename: path.join(logsDir, 'activity.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    ]
  });
  
  // Add console transport in development
  if (process.env.NODE_ENV !== 'production') {
    activityLogger.add(new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, userId, action, entityType, entityId, ...meta }) => {
          return `[${timestamp}] ${level}: User ${userId} ${action} ${entityType}${entityId ? ` ${entityId}` : ''} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
          }`;
        })
      )
    }));
  }
  
  return activityLogger;
};

const activityLogger = createActivityLogger();

// Log request information
const logRequest = (req, res, responseTime) => {
  const userId = req.user ? req.user.id : null;
  
  requestLogger.info({
    method: req.method,
    path: req.originalUrl,
    status: res.statusCode,
    responseTime,
    userId,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
};

// Log user activity
const logActivity = (userId, action, entityType, entityId = null, details = {}) => {
  activityLogger.info({
    userId,
    action,
    entityType,
    entityId,
    ...details
  });
  
  // Also store in database for analytics
  try {
    storeActivityInDb(userId, action, entityType, entityId, details)
      .catch(err => logger.error('Error storing activity in database:', err));
  } catch (error) {
    logger.error('Error calling storeActivityInDb:', error);
  }
};

// Store activity in database
const storeActivityInDb = async (userId, action, entityType, entityId, details) => {
  try {
    const db = require('../config/database');
    
    const query = `
      INSERT INTO user_activity_logs (
        user_id, action, entity_type, entity_id, details
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    const values = [
      userId,
      action,
      entityType,
      entityId,
      JSON.stringify(details)
    ];
    
    await db.query(query, values);
  } catch (error) {
    logger.error('Database error in storeActivityInDb:', error);
  }
};

module.exports = {
  logger,
  requestLogger,
  activityLogger,
  logRequest,
  logActivity
};