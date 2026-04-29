const { URL } = require('url');
const { InstrumentedPool } = require('../services/queryMonitoringService');
require('./loadEnv');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Parses a PostgreSQL connection string into a configuration object.
 * Uses the built-in URL class for robust parsing.
 */
const parseConnString = (connString) => {
  if (!connString) return null;
  try {
    const parsed = new URL(connString);
    return {
      user: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 5432,
      database: parsed.pathname.split('/')[1] || 'postgres',
    };
  } catch (e) {
    console.error('Failed to parse DATABASE_URL:', e.message);
    return null;
  }
};

const dbConfig = process.env.DATABASE_URL ? parseConnString(process.env.DATABASE_URL) : null;

// Build pool configuration
const poolConfig = dbConfig
  ? {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      password: dbConfig.password,
      ssl: { rejectUnauthorized: false },
      family: 4, // Force IPv4 for compatibility with many cloud hosts
      max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 10000,
      keepAlive: true,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'gossip',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      family: 4,
      max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 10000,
      keepAlive: true,
    };

if (isProd && !process.env.DATABASE_URL && !process.env.DB_HOST) {
  throw new Error('Database configuration (DATABASE_URL or DB_HOST) is required in production.');
}

// Create the single instrumented pool instance for the whole application
const pool = new InstrumentedPool(poolConfig);

pool.on('connect', () => {
  console.log('Connected to PostgreSQL (Instrumented Pool)');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  // Do not process.exit(-1) here to allow the process to attempt recovery or graceful shutdown
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};