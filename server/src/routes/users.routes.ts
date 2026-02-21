import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';
import { auditLog } from '../middleware/audit.js';
import * as userService from '../services/user.service.js';
import * as authService from '../services/auth.service.js';

export const userRoutes = Router();

const idParams = z.object({ id: z.string().uuid() });

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  name: z.string().min(1).max(255),
  phone: z.string().max(50).optional(),
  role: z.enum(['admin', 'moderator', 'user']).default('user'),
});

const updateUserSchema = z.object({
  name: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  preferredLanguage: z.enum(['ar', 'he', 'en']).optional(),
  role: z.enum(['admin', 'moderator', 'user']).optional(),
});

const changePasswordSchema = z.object({
  newPassword: z.string().min(8).max(72),
});

const assignmentSchema = z.object({
  ids: z.array(z.string().uuid()),
});

userRoutes.get('/', requireAuth, requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await userService.listUsers();
    res.json(result);
  } catch (err) { next(err); }
});

userRoutes.get('/2fa-status', requireAuth, requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await userService.get2FAStatuses();
    res.json(result);
  } catch (err) { next(err); }
});

userRoutes.get('/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await userService.getUser(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

userRoutes.post('/', requireAuth, requireRole('admin'), validate(createUserSchema), auditLog('create', 'users'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, role, phone } = req.body;
    const result = await authService.adminCreateUser(email, password, name, role, phone);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

userRoutes.put('/:id', requireAuth, requireRole('admin'), validate({ params: idParams, body: updateUserSchema }), auditLog('update', 'users'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await userService.updateUser(req.params.id as string, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

userRoutes.delete('/:id', requireAuth, requireRole('admin'), validate({ params: idParams }), auditLog('delete', 'users'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id as string === req.user!.userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }
    const result = await authService.adminDeleteUser(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

userRoutes.post('/:id/change-password', requireAuth, requireRole('admin'), validate({ params: idParams, body: changePasswordSchema }), auditLog('password_change', 'users'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.adminChangePassword(req.params.id as string, req.body.newPassword);
    res.json({ success: true });
  } catch (err) { next(err); }
});

userRoutes.post('/:id/disable-2fa', requireAuth, requireRole('admin'), validate({ params: idParams }), auditLog('update', 'users'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.adminDisable2FA(req.params.id as string);
    res.json({ success: true });
  } catch (err) { next(err); }
});

userRoutes.put('/:id/owner-assignments', requireAuth, requireRole('admin'), validate({ params: idParams, body: assignmentSchema }), auditLog('update', 'apartments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await userService.updateOwnerAssignments(req.params.id as string, req.body.ids);
    res.json(result);
  } catch (err) { next(err); }
});

userRoutes.put('/:id/beneficiary-assignments', requireAuth, requireRole('admin'), validate({ params: idParams, body: assignmentSchema }), auditLog('update', 'apartments'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await userService.updateBeneficiaryAssignments(req.params.id as string, req.body.ids);
    res.json(result);
  } catch (err) { next(err); }
});

userRoutes.put('/:id/building-assignments', requireAuth, requireRole('admin'), validate({ params: idParams, body: assignmentSchema }), auditLog('role_change', 'moderator_buildings'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await userService.updateBuildingAssignments(req.params.id as string, req.body.ids);
    res.json(result);
  } catch (err) { next(err); }
});
