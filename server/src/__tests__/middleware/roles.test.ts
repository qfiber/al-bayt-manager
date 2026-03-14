import { describe, it, expect, vi } from 'vitest';
import { requireRole } from '../../middleware/roles.js';

function createMockReq(user: any): any {
  return { user };
}

describe('requireRole', () => {
  it('allows matching role', () => {
    const middleware = requireRole('admin');
    const req = createMockReq({ role: 'admin', isSuperAdmin: false });
    const next = vi.fn();

    middleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('allows org_admin when admin is required (backward compat)', () => {
    const middleware = requireRole('admin');
    const req = createMockReq({ role: 'org_admin', isSuperAdmin: false });
    const next = vi.fn();

    middleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('super-admin bypasses all role checks', () => {
    const middleware = requireRole('moderator');
    const req = createMockReq({ role: 'user', isSuperAdmin: true });
    const next = vi.fn();

    middleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects insufficient role', () => {
    const middleware = requireRole('admin');
    const req = createMockReq({ role: 'user', isSuperAdmin: false });
    const next = vi.fn();

    middleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('allows any of multiple roles', () => {
    const middleware = requireRole('admin', 'moderator');
    const req = createMockReq({ role: 'moderator', isSuperAdmin: false });
    const next = vi.fn();

    middleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects unauthenticated', () => {
    const middleware = requireRole('admin');
    const req = createMockReq(undefined);
    const next = vi.fn();

    middleware(req, {} as any, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
