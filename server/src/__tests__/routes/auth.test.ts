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

const testEmail = `test-${Date.now()}@example.com`;
const testPassword = 'TestPassword123';

describe('Auth routes', () => {
  it('GET /api/auth/challenge returns a valid challenge', async () => {
    const res = await request(app).get('/api/auth/challenge');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('challengeId');
    expect(res.body).toHaveProperty('prefix');
    expect(res.body).toHaveProperty('difficulty');
  });

  it('POST /api/auth/register with PoW creates user', async () => {
    const pow = await solvePow();

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'Test User',
        ...pow,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
  });

  it('POST /api/auth/login with PoW returns tokens', async () => {
    const pow = await solvePow();

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
        ...pow,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('POST /api/auth/login rejects wrong password', async () => {
    const pow = await solvePow();

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: 'WrongPassword999',
        ...pow,
      });

    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login rejects without PoW', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(400);
  });
});
