require('dotenv').config();

const env = process.env.NODE_ENV || 'development';

const config = {
  // Application name and details
  appName: process.env.APP_NAME || 'Gossip',
  apiVersion: process.env.API_VERSION || '1.0.0',
  
  // Environment
  env: env,
  isDev: env === 'development',
  isProd: env === 'production',
  isTest: env === 'test',
  
  // Server configuration
  server: {
    port: parseInt(process.env.PORT) || 5000,
    host: process.env.HOST || 'localhost',
    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000']
  },
  
  // URLs
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:5000',
  
  // Database configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'gossip',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    ssl: process.env.DB_SSL === 'true',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000
  },
  
  // Authentication
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-should-be-long-and-secure',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    saltRounds: parseInt(process.env.SALT_ROUNDS) || 10,
    resetPasswordExpiry: parseInt(process.env.RESET_PASSWORD_EXPIRY) || 3600, // 1 hour in seconds
    verificationTokenExpiry: parseInt(process.env.VERIFICATION_TOKEN_EXPIRY) || 86400 // 24 hours in seconds
  },
  
  // File uploads
  uploads: {
    maxSize: parseInt(process.env.MAX_UPLOAD_SIZE) || 5 * 1024 * 1024, // 5MB
    allowedTypes: process.env.ALLOWED_UPLOAD_TYPES ? 
      process.env.ALLOWED_UPLOAD_TYPES.split(',') : 
      ['image/jpeg', 'image/png', 'image/gif'],
    storageType: process.env.STORAGE_TYPE || 'local', // 'local', 's3', etc.
    localPath: process.env.UPLOAD_PATH || './uploads'
  },
  
  // S3 configuration (if using)
  s3: {
    bucket: process.env.S3_BUCKET || 'gossip-uploads',
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  },
  
  // Email configuration
  email: {
    // Production email settings
    host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || 'apikey',
      pass: process.env.EMAIL_PASSWORD
    },
    from: process.env.EMAIL_FROM || 'noreply@gossip-app.com',
    
    // Development email settings (e.g., Ethereal, Mailtrap)
    devHost: process.env.DEV_EMAIL_HOST || 'smtp.ethereal.email',
    devPort: parseInt(process.env.DEV_EMAIL_PORT) || 587,
    devSecure: process.env.DEV_EMAIL_SECURE === 'true',
    devAuth: {
      user: process.env.DEV_EMAIL_USER,
      pass: process.env.DEV_EMAIL_PASSWORD
    }
  },
  
  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0
  },
  
  // Rate limiting configuration
  rateLimiting: {
    enabled: process.env.ENABLE_RATE_LIMITING !== 'false',
    enableInDev: process.env.ENABLE_RATE_LIMITING_IN_DEV === 'true'
  },
  
  // Caching configuration
  cache: {
    enabled: process.env.ENABLE_CACHING !== 'false',
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL) || 300 // 5 minutes
  },
  
  // Monitoring configuration
  monitoring: {
    enabled: process.env.ENABLE_MONITORING !== 'false',
    interval: parseInt(process.env.MONITORING_INTERVAL) || 60000 // 1 minute
  },
  
  // Social login (if using)
  socialAuth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    },
    facebook: {
      appId: process.env.FACEBOOK_APP_ID,
      appSecret: process.env.FACEBOOK_APP_SECRET
    },
    twitter: {
      consumerKey: process.env.TWITTER_CONSUMER_KEY,
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET
    }
  },
  
  // Logging
  logging: {
    level: process.env.LOG_LEVEL || (env === 'production' ? 'info' : 'debug'),
    format: process.env.LOG_FORMAT || 'json',
    dir: process.env.LOG_DIR || 'logs'
  },
  
  // Pagination defaults
  pagination: {
    defaultLimit: parseInt(process.env.DEFAULT_PAGINATION_LIMIT) || 20,
    maxLimit: parseInt(process.env.MAX_PAGINATION_LIMIT) || 100
  }
  };

module.exports = config;