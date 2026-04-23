import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  requireProjectSlot,
  requireMemberSlot,
  requireFileSizeLimit,
  requireMeetingSlot,
  requireAnalyticsAccess,
  requireApiAccess,
  requireWorkspaceCreationSlot,
} from '../../../src/modules/billing/plan.middleware.js';

import { prisma } from '../../../src/lib/prisma.js';
import { BillingService } from '../../../src/modules/billing/billing.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mockReq(overrides: Partial<Request> = {}) {
  return {
    params: {},
    headers: {},
    user: { id: 'user-1' },
    ...overrides,
  } as any;
}

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

function mockNext(): NextFunction {
  return vi.fn();
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// requireProjectSlot
// ─────────────────────────────────────────────────────────────────────────────
describe('requireProjectSlot', () => {
  it('allows when under limit', async () => {
    vi.spyOn(BillingService, 'getWorkspacePlanLimits').mockResolvedValue({
      maxProjects: 5,
    } as any);

    vi.spyOn(prisma.project, 'count').mockResolvedValue(2 as any);

    const req = mockReq({ body: { workspaceId: 'ws-1' } });
    const res = mockRes();
    const next = mockNext();

    await requireProjectSlot(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks when limit reached', async () => {
    vi.spyOn(BillingService, 'getWorkspacePlanLimits').mockResolvedValue({
      maxProjects: 2,
    } as any);

    vi.spyOn(prisma.project, 'count').mockResolvedValue(2 as any);

    const req = mockReq({ body: { workspaceId: 'ws-1' }, params: { workspaceId: 'ws-1' } });
    const res = mockRes();
    const next = mockNext();

    await requireProjectSlot(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'PLAN_LIMIT_EXCEEDED',
    }));
  });

  it('allows unlimited plan', async () => {
    vi.spyOn(BillingService, 'getWorkspacePlanLimits').mockResolvedValue({
      maxProjects: -1,
    } as any);

    const req = mockReq({ body: { workspaceId: 'ws-1' } });
    const res = mockRes();
    const next = mockNext();

    await requireProjectSlot(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireMemberSlot
// ─────────────────────────────────────────────────────────────────────────────
describe('requireMemberSlot', () => {
  it('blocks when member limit reached', async () => {
    vi.spyOn(BillingService, 'getWorkspacePlanLimits').mockResolvedValue({
      maxMembersPerWs: 1,
    } as any);

    vi.spyOn(prisma.workspaceMember, 'count').mockResolvedValue(1 as any);

    const req = mockReq({ params: { workspaceId: 'ws-1' } });
    const res = mockRes();
    const next = mockNext();

    await requireMemberSlot(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireFileSizeLimit
// ─────────────────────────────────────────────────────────────────────────────
describe('requireFileSizeLimit', () => {
  it('blocks large file upload', async () => {
    vi.spyOn(BillingService, 'getWorkspacePlanLimits').mockResolvedValue({
      maxFileSizeMb: 1,
    } as any);

    const req = mockReq({
      params: { workspaceId: 'ws-1' },
      headers: { 'content-length': `${5 * 1024 * 1024}` }, // 5MB
    });

    const res = mockRes();
    const next = mockNext();

    await requireFileSizeLimit(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireMeetingSlot
// ─────────────────────────────────────────────────────────────────────────────
describe('requireMeetingSlot', () => {
  it('blocks when monthly limit exceeded', async () => {
    vi.spyOn(BillingService, 'getWorkspacePlanLimits').mockResolvedValue({
      maxMeetingsPerMo: 1,
    } as any);

    vi.spyOn(prisma.meeting, 'count').mockResolvedValue(1 as any);

    const req = mockReq({ params: { workspaceId: 'ws-1' } });
    const res = mockRes();
    const next = mockNext();

    await requireMeetingSlot(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireAnalyticsAccess
// ─────────────────────────────────────────────────────────────────────────────
describe('requireAnalyticsAccess', () => {
  it('blocks when analytics disabled', async () => {
    vi.spyOn(BillingService, 'getWorkspacePlanLimits').mockResolvedValue({
      analyticsAccess: false,
    } as any);

    const req = mockReq({ params: { workspaceId: 'ws-1' } });
    const res = mockRes();
    const next = mockNext();

    await requireAnalyticsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireApiAccess
// ─────────────────────────────────────────────────────────────────────────────
describe('requireApiAccess', () => {
  it('blocks when API access disabled', async () => {
    vi.spyOn(BillingService, 'getWorkspacePlanLimits').mockResolvedValue({
      apiAccess: false,
    } as any);

    const req = mockReq({ params: { workspaceId: 'ws-1' } });
    const res = mockRes();
    const next = mockNext();

    await requireApiAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// requireWorkspaceCreationSlot (USER LEVEL)
// ─────────────────────────────────────────────────────────────────────────────
describe('requireWorkspaceCreationSlot', () => {
  it('blocks when user exceeds workspace limit', async () => {
    vi.spyOn(BillingService, 'getUserWorkspaceCreationLimit').mockResolvedValue(1);

    vi.spyOn(prisma.workspace, 'count').mockResolvedValue(1 as any);

    const req = mockReq();
    const res = mockRes();
    const next = mockNext();

    await requireWorkspaceCreationSlot(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});