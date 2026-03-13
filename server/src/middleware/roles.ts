import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required'));
      return;
    }
    // Super-admins bypass role checks
    if (req.user.isSuperAdmin) {
      next();
      return;
    }
    // Map legacy role names for backward compatibility
    const effectiveRoles = roles.flatMap(r => {
      if (r === 'admin') return ['admin', 'org_admin'];
      return [r];
    });
    if (!effectiveRoles.includes(req.user.role)) {
      next(new AppError(403, 'Insufficient permissions'));
      return;
    }
    next();
  };
}
