import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { verifyTurnstile } from '../services/captcha.service.js';

export const captchaRoutes = Router();

const verifySchema = z.object({
  token: z.string().min(1),
});

captchaRoutes.post('/verify', validate(verifySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const success = await verifyTurnstile(req.body.token);
    res.json({ success });
  } catch (err) { next(err); }
});
