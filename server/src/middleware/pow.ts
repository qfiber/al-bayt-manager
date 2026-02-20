import { Request, Response, NextFunction } from 'express';
import { verifyChallenge } from '../services/pow.service.js';
import { AppError } from './error-handler.js';

export function requirePow(req: Request, _res: Response, next: NextFunction): void {
  const { challengeId, nonce } = req.body;

  if (!challengeId || nonce === undefined || nonce === null) {
    next(new AppError(400, 'Proof of work required'));
    return;
  }

  if (!verifyChallenge(challengeId, String(nonce))) {
    next(new AppError(400, 'Invalid proof of work'));
    return;
  }

  next();
}
