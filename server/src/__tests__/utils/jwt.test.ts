import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken, type TokenPayload } from '../../utils/jwt.js';

describe('JWT utilities', () => {
  const payload: TokenPayload = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    email: 'test@example.com',
    role: 'admin',
  };

  describe('access tokens', () => {
    it('sign and verify roundtrip', () => {
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.role).toBe(payload.role);
    });

    it('rejects tampered tokens', () => {
      const token = signAccessToken(payload);
      const tampered = token.slice(0, -5) + 'XXXXX';

      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('refresh tokens', () => {
    it('sign and verify roundtrip', () => {
      const token = signRefreshToken({ userId: payload.userId });
      const decoded = verifyRefreshToken(token);

      expect(decoded.userId).toBe(payload.userId);
    });

    it('rejects tampered tokens', () => {
      const token = signRefreshToken({ userId: payload.userId });
      const tampered = token.slice(0, -5) + 'XXXXX';

      expect(() => verifyRefreshToken(tampered)).toThrow();
    });
  });

  it('access token cannot be verified as refresh token', () => {
    const token = signAccessToken(payload);
    expect(() => verifyRefreshToken(token)).toThrow();
  });

  describe('SaaS token fields', () => {
    it('includes organizationId in access token', () => {
      const saasPayload: TokenPayload = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        role: 'org_admin',
        organizationId: '660e8400-e29b-41d4-a716-446655440001',
        isSuperAdmin: false,
      };
      const token = signAccessToken(saasPayload);
      const decoded = verifyAccessToken(token);
      expect(decoded.organizationId).toBe(saasPayload.organizationId);
      expect(decoded.isSuperAdmin).toBe(false);
    });

    it('includes isSuperAdmin flag', () => {
      const superPayload: TokenPayload = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
        email: 'test@example.com',
        role: 'admin',
        isSuperAdmin: true,
      };
      const token = signAccessToken(superPayload);
      const decoded = verifyAccessToken(token);
      expect(decoded.isSuperAdmin).toBe(true);
    });
  });
});
