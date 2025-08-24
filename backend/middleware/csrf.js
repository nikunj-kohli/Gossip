const csrf = require('csurf');
const { logger } = require('../services/loggingService');

// CSRF protection middleware (with cookie)
const csrfProtection = csrf({
  cookie: {
    key: '_csrf',
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600 // 1 hour
  }
});

// Middleware to handle CSRF errors
const handleCsrfError = (err, req, res, next) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }

  // Log the CSRF attempt
  logger.warn('CSRF attempt detected', {
    ip: req.ip,
    path: req.path,
    headers: req.headers,
    userId: req.user?.id
  });

  // Send error response
  res.status(403).json({
    message: 'Invalid or missing CSRF token',
    error: 'FORBIDDEN'
  });
};

// Middleware to provide CSRF token
const provideCsrfToken = (req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
};

// API routes should be excluded from CSRF protection
const shouldProtectRoute = (req) => {
  // Skip CSRF for API routes
  if (req.path.startsWith('/api/')) {
    return false;
  }
  
  // Skip CSRF for authentication endpoints
  if (req.path.startsWith('/auth/')) {
    return false;
  }
  
  // Protect all other routes
  return true;
};

// Selective CSRF middleware
const selectiveCsrf = (req, res, next) => {
  if (shouldProtectRoute(req)) {
    csrfProtection(req, res, next);
  } else {
    next();
  }
};

module.exports = {
  csrfProtection,
  handleCsrfError,
  provideCsrfToken,
  selectiveCsrf
};