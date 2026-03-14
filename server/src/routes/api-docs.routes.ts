import { Router, Request, Response } from 'express';

export const apiDocsRoutes = Router();

const API_DOCS = {
  title: 'Al-Bayt Manager API',
  version: '1.0.0',
  description: 'Building Management System API',
  endpoints: [
    { method: 'POST', path: '/api/auth/login', description: 'User login', auth: false },
    { method: 'POST', path: '/api/auth/register', description: 'User registration', auth: false },
    { method: 'POST', path: '/api/auth/refresh', description: 'Refresh access token', auth: false },
    { method: 'GET', path: '/api/auth/me', description: 'Get current user', auth: true },
    { method: 'GET', path: '/api/buildings', description: 'List buildings', auth: true },
    { method: 'POST', path: '/api/buildings', description: 'Create building', auth: true, roles: ['admin'] },
    { method: 'GET', path: '/api/apartments', description: 'List apartments', auth: true },
    { method: 'POST', path: '/api/apartments', description: 'Create apartment', auth: true, roles: ['admin'] },
    { method: 'GET', path: '/api/payments', description: 'List payments', auth: true },
    { method: 'POST', path: '/api/payments', description: 'Create payment', auth: true, roles: ['admin', 'moderator'] },
    { method: 'GET', path: '/api/expenses', description: 'List expenses', auth: true },
    { method: 'POST', path: '/api/expenses', description: 'Create expense', auth: true, roles: ['admin', 'moderator'] },
    { method: 'GET', path: '/api/reports/summary', description: 'Financial summary', auth: true },
    { method: 'GET', path: '/api/issues', description: 'List issues', auth: true },
    { method: 'POST', path: '/api/issues', description: 'Create issue', auth: true },
    { method: 'GET', path: '/api/my-apartments', description: 'Tenant: list my apartments', auth: true },
    { method: 'POST', path: '/api/payments/checkout', description: 'Online payment checkout', auth: true },
    { method: 'GET', path: '/api/v1/buildings', description: 'API v1: List buildings', auth: 'api-key' },
    { method: 'GET', path: '/api/v1/apartments', description: 'API v1: List apartments', auth: 'api-key' },
    { method: 'GET', path: '/api/v1/apartments/:id', description: 'API v1: Get apartment', auth: 'api-key' },
  ],
};

apiDocsRoutes.get('/', (_req: Request, res: Response) => {
  res.json(API_DOCS);
});
