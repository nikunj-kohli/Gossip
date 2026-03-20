const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL if available, otherwise fall back to individual variables
const poolConfig = process.env.DATABASE_URL 
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        family: 4  // Force IPv4
    }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        family: 4  // Force IPv4
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