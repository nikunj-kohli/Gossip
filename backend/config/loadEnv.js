const path = require('path');
const dotenv = require('dotenv');

// Prevent loading .env files multiple times when modules import this helper.
if (!global.__GOSSIP_ENV_LOADED__) {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const backendDir = path.resolve(__dirname, '..');
  const rootDir = path.resolve(backendDir, '..');

  // Priority order: environment-specific files first, then generic fallbacks.
  const candidates = [
    path.join(backendDir, `.env.${nodeEnv}`),
    path.join(rootDir, `.env.${nodeEnv}`),
    path.join(backendDir, '.env'),
    path.join(rootDir, '.env')
  ];

  for (const envPath of candidates) {
    dotenv.config({ path: envPath });
  }

  global.__GOSSIP_ENV_LOADED__ = true;
}
