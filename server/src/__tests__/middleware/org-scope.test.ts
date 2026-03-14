import { describe, it, expect, vi } from 'vitest';
import { requireOrgScope, requireSuperAdmin } from '../../middleware/org-scope.js';

function createMockReq(user: any, query: any = {}): any {
  return { user, query };
}

function createMockRes(): any {
  return {};
}

describe('requireOrgScope', () => {
  it('sets organizationId from JWT for regular user', () => {
    const req = createMockReq({ organizationId: 'org-123', isSuperAdmin: false });
    const res = createMockRes();
    const next = vi.fn();

    requireOrgScope(req, res, next);

    expect(req.organizationId).toBe('org-123');
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects user with no organizationId', () => {
    const req = createMockReq({ isSuperAdmin: false });
    const res = createMockRes();
    const next = vi.fn();

    requireOrgScope(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('allows super-admin with orgId query param', () => {
    const req = createMockReq({ isSuperAdmin: true, organizationId: 'default-org' }, { orgId: 'specific-org' });
    const res = createMockRes();
    const next = vi.fn();

    requireOrgScope(req, res, next);

    expect(req.organizationId).toBe('specific-org');
    expect(next).toHaveBeenCalledWith();
  });

  it('super-admin without orgId uses own organizationId', () => {
    const req = createMockReq({ isSuperAdmin: true, organizationId: 'own-org' });
    const res = createMockRes();
    const next = vi.fn();

    requireOrgScope(req, res, next);

    expect(req.organizationId).toBe('own-org');
    expect(next).toHaveBeenCalledWith();
  });

  it('super-admin without any orgId gets undefined (cross-org access)', () => {
    const req = createMockReq({ isSuperAdmin: true });
    const res = createMockRes();
    const next = vi.fn();

    requireOrgScope(req, res, next);

    expect(req.organizationId).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects unauthenticated request', () => {
    const req = createMockReq(undefined);
    const res = createMockRes();
    const next = vi.fn();

    requireOrgScope(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('requireSuperAdmin', () => {
  it('allows super-admin', () => {
    const req = createMockReq({ isSuperAdmin: true });
    const res = createMockRes();
    const next = vi.fn();

    requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('rejects non-super-admin', () => {
    const req = createMockReq({ isSuperAdmin: false });
    const res = createMockRes();
    const next = vi.fn();

    requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('rejects when no user', () => {
    const req = createMockReq(undefined);
    const res = createMockRes();
    const next = vi.fn();

    requireSuperAdmin(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
});
