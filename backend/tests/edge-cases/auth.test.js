const request = require('supertest');
const app = require('../../server');
const db = require('../../config/database');
const { hashPassword } = require('../../utils/auth');

describe('Authentication Edge Cases', () => {
  // Setup test user
  beforeAll(async () => {
    // Create test user with known password
    const hashedPassword = await hashPassword('TestPassword123');
    await db.query(
      `INSERT INTO users (username, email, password, is_active, is_verified)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO NOTHING`,
      ['testuser', 'test@example.com', hashedPassword, true, true]
    );
  });

  // Clean up after tests
  afterAll(async () => {
    // Don't delete test user in case other tests need it
    await db.end();
  });

  // Test edge cases
  
  test('Login should fail with correct username but incorrect password format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'short'
      });
    
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });
  
  test('Login should fail with SQL injection attempt in email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: "' OR 1=1 --",
        password: 'TestPassword123'
      });
    
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });
  
  test('Login should fail with SQL injection attempt in password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: "' OR 1=1 --"
      });
    
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('message');
  });
  
  test('Login should handle excessive long inputs gracefully', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'a'.repeat(1000) + '@example.com',
        password: 'b'.repeat(1000)
      });
    
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
  
  test('Registration should validate password complexity', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'complexpass',
        email: 'complex@example.com',
        password: '12345678' // Missing complexity
      });
    
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('password');
  });
  
  test('Registration should detect duplicate email with different case', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testcase',
        email: 'TEST@example.com', // Same as test@example.com but different case
        password: 'ComplexPass123!'
      });
    
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('email');
  });
  
  test('Password reset should not reveal if email exists', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({
        email: 'nonexistent@example.com'
      });
    
    // Should return success even if email doesn't exist
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
  
  test('Token verification should fail with invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({
        token: 'invalid-token-format'
      });
    
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });
  
  test('Token verification should fail with expired token', async () => {
    // Insert expired token in database
    const userId = (await db.query('SELECT id FROM users WHERE email = $1', ['test@example.com'])).rows[0].id;
    
    // Create expired token (1 day ago)
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() - 1);
    
    await db.query(
      `INSERT INTO verification_tokens (user_id, token, type, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, 'expired-test-token', 'email', expiredDate]
    );
    
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({
        token: 'expired-test-token'
      });
    
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('expired');
  });
});