const { Pool } = require('pg');
require('./loadEnv');

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production. Configure Supabase connection string.');
}

// Parse DATABASE_URL into components to ensure IPv4 is used
const parseConnString = (connString) => {
  if (!connString) return null;
  try {
    // Format: postgresql://user:password@host:port/database
    const match = connString.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
    if (!match) return null;
    return {
      user: decodeURIComponent(match[1]),
      password: decodeURIComponent(match[2]),
      host: match[3],
      port: parseInt(match[4]),
      database: match[5].split('?')[0]
    };
  } catch (e) {
    return null;
  }
};

const dbConfig = process.env.DATABASE_URL ? parseConnString(process.env.DATABASE_URL) : null;

// Use DATABASE_URL if available, otherwise fall back to individual variables
const poolConfig = dbConfig
    ? {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: { rejectUnauthorized: false },
    max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 50,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 5000,
    keepAlive: true,
    }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 50,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 5000,
    keepAlive: true,
    };

const pool = new Pool(poolConfig);


pool.on('connect', () => {
    console.log('Connected to PostgreSQL');
})

pool.on('error', (err) => {
    console.error('Unexpected error', err);
    process.exit(-1);
})

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
}