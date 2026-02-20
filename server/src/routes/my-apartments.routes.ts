import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as apartmentService from '../services/apartment.service.js';

export const myApartmentRoutes = Router();

myApartmentRoutes.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await apartmentService.getMyApartments(req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
});
