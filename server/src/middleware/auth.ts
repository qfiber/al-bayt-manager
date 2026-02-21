import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt.js';
import { AppError } from './error-handler.js';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      allowedBuildingIds?: string[];
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  // Prefer httpOnly cookie, fall back to Authorization header
  const cookieToken = req.cookies?.access_token as string | undefined;
  const header = req.headers.authorization;
  const token = cookieToken || (header?.startsWith('Bearer ') ? header.slice(7) : undefined);

  if (!token) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}
