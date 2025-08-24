const promClient = require('prom-client');
const config = require('../config/config');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// HTTP request duration metric
const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
});

// HTTP request counter
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Active users gauge
const activeUsersGauge = new promClient.Gauge({
  name: 'active_users',
  help: 'Number of currently active users'
});

// Database query duration
const dbQueryDurationMicroseconds = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_name'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2]
});

// Cache hit ratio
const cacheHitRatio = new promClient.Gauge({
  name: 'cache_hit_ratio',
  help: 'Ratio of cache hits to total cache requests',
  labelNames: ['cache_type']
});

// API errors counter
const apiErrorsTotal = new promClient.Counter({
  name: 'api_errors_total',
  help: 'Total number of API errors',
  labelNames: ['method', 'route', 'error_code']
});

// Register metrics
register.registerMetric(httpRequestDurationMicroseconds);
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeUsersGauge);
register.registerMetric(dbQueryDurationMicroseconds);
register.registerMetric(cacheHitRatio);
register.registerMetric(apiErrorsTotal);

// Update active users
const updateActiveUsers = (count) => {
  activeUsersGauge.set(count);
};

// Record database query
const recordDbQuery = (queryName, durationMs) => {
  dbQueryDurationMicroseconds.observe({ query_name: queryName }, durationMs / 1000);
};

// Update cache hit ratio
const updateCacheHitRatio = (cacheType, hits, total) => {
  if (total > 0) {
    cacheHitRatio.set({ cache_type: cacheType }, hits / total);
  }
};

// Middleware to collect HTTP metrics
const metricsMiddleware = (req, res, next) => {
  // Skip metrics for the metrics endpoint itself
  if (req.path === '/metrics') {
    return next();
  }
  
  // Record start time
  const start = Date.now();
  
  // Record route (normalize to prevent cardinality explosion)
  let route = req.route ? req.baseUrl + req.route.path : 'unknown';
  
  // Replace route parameters with placeholders
  route = route.replace(/\/:[^/]+/g, '/:param');
  
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function
  res.end = function(...args) {
    // Calculate duration
    const duration = (Date.now() - start) / 1000;
    
    // Record metrics
    const labels = { 
      method: req.method, 
      route, 
      status_code: res.statusCode 
    };
    
    httpRequestDurationMicroseconds.observe(labels, duration);
    httpRequestsTotal.inc(labels);
    
    // Call original end function
    return originalEnd.apply(this, args);
  };
  
  next();
};

// Middleware to record API errors
const errorMetricsMiddleware = (err, req, res, next) => {
  // Record route (normalize to prevent cardinality explosion)
  let route = req.route ? req.baseUrl + req.route.path : 'unknown';
  
  // Replace route parameters with placeholders
  route = route.replace(/\/:[^/]+/g, '/:param');
  
  // Record error
  apiErrorsTotal.inc({ 
    method: req.method, 
    route, 
    error_code: err.status || 500 
  });
  
  next(err);
};

module.exports = {
  register,
  updateActiveUsers,
  recordDbQuery,
  updateCacheHitRatio,
  metricsMiddleware,
  errorMetricsMiddleware
};