import { Request, Response, NextFunction } from 'express';
import { sanitizeObject } from '../utils/sanitize.js';

/**
 * Middleware that sanitizes all string values in req.body.
 * Strips HTML tags and trims whitespace to prevent XSS.
 * Apply globally or per-route.
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}
