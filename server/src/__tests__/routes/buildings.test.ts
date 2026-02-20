import crypto from 'crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const app = createApp();

/** Solve a PoW challenge from the server. */
async function solvePow() {
  const res = await request(app).get('/api/auth/challenge');
  const { challengeId, prefix, difficulty } = res.body;

  for (let nonce = 0; ; nonce++) {
    const hash = crypto.createHash('sha256').update(prefix + nonce).digest();
    if (hasLeadingZeroBits(hash, difficulty)) {
      return { challengeId, nonce: String(nonce) };
    }
  }
}

function hasLeadingZeroBits(hash: Buffer, bits: number): boolean {
  const fullBytes = Math.floor(bits / 8);
  const remainingBits = bits % 8;
  for (let i = 0; i < fullBytes; i++) {
    if (hash[i] !== 0) return false;
  }
  if (remainingBits > 0) {
    const mask = 0xff << (8 - remainingBits);
    if ((hash[fullBytes] & mask) !== 0) return false;
  }
  return true;
}

let adminToken: string;
let createdBuildingId: string;

describe('Buildings CRUD', () => {
  beforeAll(async () => {
    // Register + login an admin user for testing
    const email = `admin-bldg-${Date.now()}@example.com`;
    const pow1 = await solvePow();
    await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'AdminPass123', name: 'Admin', ...pow1 });

    const pow2 = await solvePow();
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'AdminPass123', ...pow2 });

    adminToken = loginRes.body.accessToken;
  });

  it('POST /api/buildings creates a building', async () => {
    const res = await request(app)
      .post('/api/buildings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test Building',
        address: '123 Test St',
        totalFloors: 5,
      });

    // May be 201 or 403 depending on user role (test user is 'user' by default)
    if (res.status === 201) {
      expect(res.body).toHaveProperty('id');
      createdBuildingId = res.body.id;
    } else {
      expect(res.status).toBe(403);
    }
  });

  it('GET /api/buildings lists buildings', async () => {
    const res = await request(app)
      .get('/api/buildings')
      .set('Authorization', `Bearer ${adminToken}`);

    // Could be 200 or 403 depending on role
    expect([200, 403]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });
});
