const CircuitBreaker = require('opossum');
const { logger } = require('./loggingService');

// Default options for circuit breakers
const defaultOptions = {
  timeout: 3000, // If function takes longer than 3 seconds, trigger a failure
  errorThresholdPercentage: 50, // When 50% of requests fail, trip circuit
  resetTimeout: 30000, // After 30 seconds, try again
  rollingCountTimeout: 10000, // Sets the duration of the statistical rolling window
  rollingCountBuckets: 10 // Sets the number of buckets within the rolling window
};

// Circuit breaker registry
const breakers = new Map();

// Create or retrieve a circuit breaker for a service
const getBreaker = (serviceName, fallbackFn, options = {}) => {
  if (!breakers.has(serviceName)) {
    const breakerOptions = { ...defaultOptions, ...options };
    
    // Create a new circuit breaker
    const breaker = new CircuitBreaker(async (...args) => {
      throw new Error('No command provided to circuit breaker');
    }, breakerOptions);
    
    // Configure listeners
    breaker.on('open', () => {
      logger.warn(`Circuit breaker for ${serviceName} is now OPEN (failing fast)`);
    });
    
    breaker.on('halfOpen', () => {
      logger.info(`Circuit breaker for ${serviceName} is now HALF OPEN (next request will test the service)`);
    });
    
    breaker.on('close', () => {
      logger.info(`Circuit breaker for ${serviceName} is now CLOSED (service is operational)`);
    });
    
    breaker.on('fallback', (result, err, args) => {
      logger.info(`Circuit breaker for ${serviceName} executed fallback`, { error: err.message });
    });
    
    // Set fallback function if provided
    if (fallbackFn) {
      breaker.fallback(fallbackFn);
    }
    
    breakers.set(serviceName, breaker);
  }
  
  return breakers.get(serviceName);
};

// Execute a function with circuit breaker protection
const executeWithBreaker = async (serviceName, fn, fallbackFn, options = {}) => {
  const breaker = getBreaker(serviceName, fallbackFn, options);
  
  // Set the function to be executed
  breaker.fn = fn;
  
  try {
    return await breaker.fire();
  } catch (error) {
    logger.error(`Circuit breaker for ${serviceName} caught an error:`, error);
    throw error;
  }
};

// Reset a circuit breaker
const resetBreaker = (serviceName) => {
  if (breakers.has(serviceName)) {
    const breaker = breakers.get(serviceName);
    breaker.close();
    return true;
  }
  return false;
};

// Get the status of a circuit breaker
const getBreakerStatus = (serviceName) => {
  if (!breakers.has(serviceName)) {
    return { exists: false };
  }
  
  const breaker = breakers.get(serviceName);
  
  return {
    exists: true,
    state: breaker.status.state,
    stats: {
      successful: breaker.stats.successes,
      failed: breaker.stats.failures,
      rejected: breaker.stats.rejects,
      timeout: breaker.stats.timeouts
    }
  };
};

module.exports = {
  executeWithBreaker,
  getBreaker,
  resetBreaker,
  getBreakerStatus
};