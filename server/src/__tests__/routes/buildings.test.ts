import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { signAccessToken } from '../../utils/jwt.js';
import { db } from '../../config/database.js';

let dbAvailable = false;
try {
  await db.execute({ sql: 'SELECT 1', params: [] } as any).catch(() => {});
  dbAvailable = true;
} catch {}

const describeDb = dbAvailable ? describe : describe.skip;
const app = createApp();

// Create a valid admin token directly (no DB needed for unit-style test)
const adminToken = signAccessToken({
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'admin-test@example.com',
  role: 'admin',
  isSuperAdmin: false,
});

const userToken = signAccessToken({
  userId: '660e8400-e29b-41d4-a716-446655440001',
  email: 'user-test@example.com',
  role: 'user',
  isSuperAdmin: false,
});

describeDb('Buildings CRUD', () => {
  it('POST /api/buildings rejects unauthenticated', async () => {
    const res = await request(app)
      .post('/api/buildings')
      .send({ name: 'Test Building', address: '123 Test St' });

    expect(res.status).toBe(401);
  });

  it('POST /api/buildings rejects non-admin role', async () => {
    const res = await request(app)
      .post('/api/buildings')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Test Building', address: '123 Test St' });

    expect(res.status).toBe(403);
  });

  it('GET /api/buildings rejects unauthenticated', async () => {
    const res = await request(app)
      .get('/api/buildings');

    expect(res.status).toBe(401);
  });

  it('GET /api/buildings accepts authenticated user', async () => {
    const res = await request(app)
      .get('/api/buildings')
      .set('Authorization', `Bearer ${adminToken}`);

    // 200 with data (may be empty array if no buildings in test DB)
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
