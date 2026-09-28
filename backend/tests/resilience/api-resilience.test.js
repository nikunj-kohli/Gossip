/**
 * API resilience tests - the deploy guard.
 *
 * These tests exist because a real production outage happened on 2026-09-28:
 * the Redis-backed rate limiter turned every /api/* request into a 500 when
 * Redis was unreachable. These tests boot the real app with no Redis and
 * assert the API degrades gracefully instead of failing.
 *
 * No database is required: endpoints that need one may 500 *with a JSON
 * error body*, but requests that never need the DB (validation paths,
 * health/docs) must behave correctly, and NOTHING may 500 because of
 * infrastructure middleware.
 */
const request = require('supertest');

// Force the production failure mode: Redis configured but unreachable.
process.env.NODE_ENV = 'production';
process.env.ENABLE_CACHING = 'true';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6390'; // nothing listening here
process.env.REDIS_PASSWORD = 'unused';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.PORT = process.env.PORT || '5057';

// Minimal production env validation placeholders (config.js requires these)
process.env.CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'test-cloud';
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || 'test-key';
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || 'test-secret';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://invalid:invalid@127.0.0.1:5999/none';

const app = require('../../server');

const jsonError = (res) => {
  try {
    return Boolean(typeof res.body === 'object' && res.body !== null && (res.body.error || res.body.message));
  } catch {
    return false;
  }
};

describe('API resilience (Redis unreachable)', () => {
  test('health endpoint responds 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('login with empty body returns 400 (validation), never 500', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({})
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(jsonError(res)).toBe(true);
  });

  test('login rate limiting still enforced without Redis (429 after threshold)', async () => {
    // auth limiter: 20 points/hour - the earlier test consumed some already;
    // hammer past the limit and expect at least one 429 eventually.
    let saw429 = false;
    for (let i = 0; i < 25; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({})
        .set('Content-Type', 'application/json');
      if (res.status === 429) {
        saw429 = true;
        break;
      }
      expect(res.status).toBe(400); // never 500
    }
    expect(saw429).toBe(true);
  });

  test('register with invalid email returns 400/validation status, never 500', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'x', email: 'not-an-email', password: 'y' })
      .set('Content-Type', 'application/json');
    // Either 400 (validation) or 401/403 style client errors are acceptable;
    // a 500 caused by middleware is not.
    expect(res.status).toBeLessThan(500);
  });
});
