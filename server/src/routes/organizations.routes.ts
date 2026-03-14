import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/org-scope.js';
import { auditLog } from '../middleware/audit.js';
import * as organizationService from '../services/organization.service.js';
import * as authService from '../services/auth.service.js';
import { setAuthCookies } from '../utils/cookie.js';

export const organizationRoutes = Router();

const createOrgSchema = z.object({
  name: z.string().min(1).max(255),
  defaultLanguage: z.enum(['ar', 'he', 'en']).optional(),
  maxBuildings: z.number().int().min(0).max(10000).optional(),
  maxApartments: z.number().int().min(0).max(100000).optional(),
  maxTenants: z.number().int().min(0).max(100000).optional(),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  defaultLanguage: z.enum(['ar', 'he', 'en']).optional(),
  maxBuildings: z.number().int().min(0).max(10000).optional(),
  maxApartments: z.number().int().min(0).max(100000).optional(),
  maxTenants: z.number().int().min(0).max(100000).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['org_admin', 'moderator', 'user']),
});

// List all organizations (super-admin only)
organizationRoutes.get('/', requireAuth, requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await organizationService.listOrganizations();
    res.json(result);
  } catch (err) { next(err); }
});

// Get single organization
organizationRoutes.get('/:id', requireAuth, requireSuperAdmin, validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await organizationService.getOrganization(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

// Create organization
organizationRoutes.post('/', requireAuth, requireSuperAdmin, validate(createOrgSchema), auditLog('create', 'organizations'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await organizationService.createOrganization(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// Update organization
organizationRoutes.put('/:id', requireAuth, requireSuperAdmin, validate({ params: idParams, body: updateOrgSchema }), auditLog('update', 'organizations'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await organizationService.updateOrganization(req.params.id as string, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

// Delete organization
organizationRoutes.delete('/:id', requireAuth, requireSuperAdmin, validate({ params: idParams }), auditLog('delete', 'organizations'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await organizationService.deleteOrganization(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

// List members of an organization
organizationRoutes.get('/:id/members', requireAuth, requireSuperAdmin, validate({ params: idParams }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await organizationService.listMembers(req.params.id as string);
    res.json(result);
  } catch (err) { next(err); }
});

// Add member to organization
organizationRoutes.post('/:id/members', requireAuth, requireSuperAdmin, validate({ params: idParams, body: addMemberSchema }), auditLog('create', 'organization_members'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await organizationService.addMemberByEmail(req.params.id as string, req.body.email, req.body.role);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// Remove member from organization
organizationRoutes.delete('/:id/members/:userId', requireAuth, requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await organizationService.removeMember(req.params.id as string, req.params.userId as string);
    res.json(result);
  } catch (err) { next(err); }
});

// Impersonate a user (login as them) — super-admin only
organizationRoutes.post('/impersonate/:userId', requireAuth, requireSuperAdmin, auditLog('login', 'users'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.impersonateUser(req.params.userId as string, req.user!.userId);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    res.json({ success: true });
  } catch (err) { next(err); }
});
