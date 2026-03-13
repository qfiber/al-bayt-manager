import { Request, Response, NextFunction } from 'express';
import { AppError } from './error-handler.js';

declare global {
  namespace Express {
    interface Request {
      organizationId?: string;
    }
  }
}

/**
 * Middleware that extracts organizationId from the JWT and attaches it to the request.
 * Super-admins can optionally scope to a specific org via ?orgId= query param.
 * Non-super-admins are always scoped to their own org.
 */
export function requireOrgScope(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  if (req.user.isSuperAdmin) {
    // Super-admins can optionally scope to a specific org
    const orgIdParam = req.query.orgId as string | undefined;
    req.organizationId = orgIdParam || req.user.organizationId;
  } else {
    if (!req.user.organizationId) {
      next(new AppError(403, 'No organization assigned'));
      return;
    }
    req.organizationId = req.user.organizationId;
  }

  next();
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isSuperAdmin) {
    next(new AppError(403, 'Super admin access required'));
    return;
  }
  next();
}
