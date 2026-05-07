const { logger } = require('./loggingService');
const { Pool } = require('pg');

// Threshold for slow queries in milliseconds
const SLOW_QUERY_THRESHOLD = 500;
const logAllQueries = process.env.LOG_ALL_QUERIES === 'true';

/**
 * InstrumentedPool extends the standard pg Pool to add query monitoring,
 * logging, and performance tracking.
 */
class InstrumentedPool extends Pool {
  constructor(options) {
    super(options);
    
    // Store original query method
    this._originalQuery = this.query;
    
    // Override query method
    this.query = this._instrumentedQuery.bind(this);
  }
  
  async _instrumentedQuery(text, params) {
    const start = Date.now();
    let result;
    let error;
    
    try {
      // Execute the query
      result = await this._originalQuery.call(this, text, params);
      return result;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      const duration = Date.now() - start;
      
      // Extract query name from comments if available: /* GetUserProfile */
      const queryName = (text.match(/\/\*\s*([^*]+)\s*\*\//) || [])[1] || 'anonymous';
      
      // Avoid per-query log overhead unless explicitly enabled.
      if (logAllQueries) {
        logger.debug('Database query executed', {
          query: queryName,
          duration,
          rows: result ? result.rowCount : 0
        });
      }
      
      // Log slow queries as warnings
      if (duration > SLOW_QUERY_THRESHOLD) {
        logger.warn('Slow query detected', {
          query: queryName,
          duration,
          threshold: SLOW_QUERY_THRESHOLD,
          sql: text.substring(0, 200), // Truncate long queries
          rows: result ? result.rowCount : 0
        });
        
        // Store slow query in database for analysis
        this._storeSlowQuery(queryName, text, params, duration, error)
          .catch(err => logger.error('Error storing slow query:', err));
      }
      
      // If an error occurred, log it
      if (error) {
        logger.error('Query error', {
          query: queryName,
          duration,
          error: error.message,
          code: error.code
        });
      }
    }
  }
  
  // Store slow query information in database
  async _storeSlowQuery(name, text, params, duration, error) {
    try {
      const query = `
        INSERT INTO query_performance_logs (
          query_name, query_text, parameters, duration_ms, 
          error_message, error_code
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      const values = [
        name,
        text,
        JSON.stringify(params || []),
        duration,
        error ? error.message : null,
        error ? error.code : null
      ];
      
      // Use original query to avoid infinite loop
      await this._originalQuery.call(this, query, values);
    } catch (err) {
      logger.error('Failed to store slow query:', err);
    }
  }
}

/**
 * Migration for query performance logs table
 * @param {InstrumentedPool} pool 
 */
const createQueryLogsTable = async (pool) => {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS query_performance_logs (
        id SERIAL PRIMARY KEY,
        query_name VARCHAR(100),
        query_text TEXT NOT NULL,
        parameters JSONB,
        duration_ms INTEGER NOT NULL,
        error_message TEXT,
        error_code VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_query_perf_query_name ON query_performance_logs(query_name);
      CREATE INDEX IF NOT EXISTS idx_query_perf_duration ON query_performance_logs(duration_ms);
      CREATE INDEX IF NOT EXISTS idx_query_perf_created_at ON query_performance_logs(created_at);
    `;
    
    // Use _originalQuery or query (InstrumentedPool handles it)
    await (pool._originalQuery || pool.query).call(pool, createTableQuery);
    logger.info('Query performance logs table initialized');
  } catch (error) {
    logger.error('Error creating query logs table:', error);
  }
};

/**
 * Initialize the monitoring system
 * @param {InstrumentedPool} pool 
 */
const initQueryMonitoring = async (pool) => {
  await createQueryLogsTable(pool);
  
  // Cleanup old logs on startup (older than 7 days)
  try {
    const cleanupQuery = `
      DELETE FROM query_performance_logs WHERE created_at < NOW() - INTERVAL '7 days';
    `;
    await (pool._originalQuery || pool.query).call(pool, cleanupQuery);
    logger.info('Old query performance logs pruned');
  } catch (err) {
    logger.error('Failed to prune old query logs:', err);
  }

  logger.info('Query monitoring system initialized');
};

/**
 * Get slow query report
 * @param {InstrumentedPool} pool 
 * @param {number} threshold 
 * @param {number} limit 
 */
const getSlowQueryReport = async (pool, threshold = SLOW_QUERY_THRESHOLD, limit = 100) => {
  try {
    const query = `
      SELECT 
        query_name,
        AVG(duration_ms) as avg_duration,
        MAX(duration_ms) as max_duration,
        MIN(duration_ms) as min_duration,
        COUNT(*) as execution_count,
        MAX(created_at) as last_execution
      FROM query_performance_logs
      WHERE duration_ms > $1
      GROUP BY query_name
      ORDER BY avg_duration DESC
      LIMIT $2
    `;
    
    const result = await (pool._originalQuery || pool.query).call(pool, query, [threshold, limit]);
    return result.rows;
  } catch (error) {
    logger.error('Error generating slow query report:', error);
    return [];
  }
};

module.exports = {
  InstrumentedPool,
  initQueryMonitoring,
  getSlowQueryReport,
  SLOW_QUERY_THRESHOLD
};