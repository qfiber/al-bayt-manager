import crypto from 'crypto';
import { describe, it, expect } from 'vitest';
import { createChallenge, verifyChallenge } from '../../services/pow.service.js';

/** Solve a challenge with brute force (low difficulty in tests = fast). */
function solveChallenge(prefix: string, difficulty: number): string {
  for (let nonce = 0; ; nonce++) {
    const hash = crypto.createHash('sha256').update(prefix + nonce).digest();
    if (hasLeadingZeroBits(hash, difficulty)) return String(nonce);
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

describe('PoW service', () => {
  it('creates a challenge with expected fields', () => {
    const challenge = createChallenge();
    expect(challenge).toHaveProperty('challengeId');
    expect(challenge).toHaveProperty('prefix');
    expect(challenge).toHaveProperty('difficulty');
    expect(typeof challenge.prefix).toBe('string');
    expect(challenge.difficulty).toBe(8); // from setup.ts POW_DIFFICULTY=8
  });

  it('verifies a valid proof', () => {
    const { challengeId, prefix, difficulty } = createChallenge();
    const nonce = solveChallenge(prefix, difficulty);
    expect(verifyChallenge(challengeId, nonce)).toBe(true);
  });

  it('rejects one-time use (consumed challenge)', () => {
    const { challengeId, prefix, difficulty } = createChallenge();
    const nonce = solveChallenge(prefix, difficulty);

    expect(verifyChallenge(challengeId, nonce)).toBe(true);
    // Second use should fail
    expect(verifyChallenge(challengeId, nonce)).toBe(false);
  });

  it('rejects an invalid nonce', () => {
    const { challengeId } = createChallenge();
    expect(verifyChallenge(challengeId, 'definitely-wrong')).toBe(false);
  });

  it('rejects an unknown challengeId', () => {
    expect(verifyChallenge('00000000-0000-0000-0000-000000000000', '0')).toBe(false);
  });
});
