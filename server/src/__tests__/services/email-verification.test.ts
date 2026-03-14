import { describe, it, expect } from 'vitest';
import { createVerificationSession, verifyCode, getSessionByToken } from '../../services/email-verification.service.js';

describe('email verification service', () => {
  it('creates a session with 6-digit code', () => {
    const { token, code } = createVerificationSession('user-1', 'test@example.com');
    expect(token).toBeTruthy();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('verifies correct code', () => {
    const { token, code } = createVerificationSession('user-2', 'test2@example.com');
    const result = verifyCode(token, code);
    expect(result.userId).toBe('user-2');
    expect(result.email).toBe('test2@example.com');
  });

  it('rejects wrong code', () => {
    const { token } = createVerificationSession('user-3', 'test3@example.com');
    expect(() => verifyCode(token, '000000')).toThrow('Invalid verification code');
  });

  it('rejects invalid token', () => {
    expect(() => verifyCode('nonexistent-token', '123456')).toThrow();
  });

  it('session is consumed after successful verification', () => {
    const { token, code } = createVerificationSession('user-4', 'test4@example.com');
    verifyCode(token, code);
    expect(() => verifyCode(token, code)).toThrow();
  });

  it('limits attempts to 5', () => {
    const { token } = createVerificationSession('user-5', 'test5@example.com');
    for (let i = 0; i < 5; i++) {
      try { verifyCode(token, '000000'); } catch {}
    }
    expect(() => verifyCode(token, '000000')).toThrow('Too many attempts');
  });

  it('getSessionByToken returns session', () => {
    const { token } = createVerificationSession('user-6', 'test6@example.com');
    const session = getSessionByToken(token);
    expect(session).toBeTruthy();
    expect(session?.userId).toBe('user-6');
  });

  it('getSessionByToken returns undefined for invalid token', () => {
    const session = getSessionByToken('nonexistent');
    expect(session).toBeUndefined();
  });
});
