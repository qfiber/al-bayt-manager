import crypto from 'crypto';
import { env } from '../config/env.js';

interface Challenge {
  prefix: string;
  difficulty: number;
  createdAt: number;
  consumed: boolean;
}

const challenges = new Map<string, Challenge>();

// Periodic cleanup every 60s
setInterval(() => {
  const now = Date.now();
  for (const [id, challenge] of challenges) {
    if (now - challenge.createdAt > env.POW_CHALLENGE_TTL_MS) {
      challenges.delete(id);
    }
  }
}, 60_000);

export function createChallenge() {
  const challengeId = crypto.randomUUID();
  const prefix = crypto.randomBytes(16).toString('hex');
  const difficulty = env.POW_DIFFICULTY;

  challenges.set(challengeId, {
    prefix,
    difficulty,
    createdAt: Date.now(),
    consumed: false,
  });

  return { challengeId, difficulty, prefix };
}

/**
 * Check if SHA-256(prefix + nonce) has at least `difficulty` leading zero bits.
 */
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

export function verifyChallenge(challengeId: string, nonce: string): boolean {
  const challenge = challenges.get(challengeId);
  if (!challenge) return false;
  if (challenge.consumed) return false;
  if (Date.now() - challenge.createdAt > env.POW_CHALLENGE_TTL_MS) {
    challenges.delete(challengeId);
    return false;
  }

  const hash = crypto.createHash('sha256').update(challenge.prefix + nonce).digest();
  if (!hasLeadingZeroBits(hash, challenge.difficulty)) return false;

  // One-time use
  challenge.consumed = true;
  return true;
}
