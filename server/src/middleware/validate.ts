import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from './error-handler.js';

interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidationSchemas | ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const s: ValidationSchemas = schemas instanceof ZodSchema ? { body: schemas } : schemas;

      if (s.body) {
        req.body = s.body.parse(req.body);
      }
      if (s.params) {
        req.params = s.params.parse(req.params) as any;
      }
      if (s.query) {
        req.query = s.query.parse(req.query) as any;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(new AppError(400, 'Validation error', err.flatten().fieldErrors));
        return;
      }
      next(err);
    }
  };
}
