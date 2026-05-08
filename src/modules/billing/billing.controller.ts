// backend/src/billing/controller/billing.controller.ts
import { Response }        from 'express';
import { BillingService } from './billing.service.js';
import { BillingCycle }   from '@prisma/client';
import { AuthRequest } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';

// ---------------------------------------------------------------------------
// Error handler — mirrors AnalyticsController pattern
// ---------------------------------------------------------------------------

function handleBillingError(res: Response, error: unknown): Response {
  const msg = error instanceof Error ? error.message : 'Internal billing error';

  if (msg.includes('FORBIDDEN'))   return res.status(403).json({ error: msg.replace('FORBIDDEN: ', '') });
  if (msg.includes('NOT_FOUND'))   return res.status(404).json({ error: msg.replace('NOT_FOUND: ', '') });
  if (msg.includes('CONFLICT'))    return res.status(409).json({ error: msg.replace('CONFLICT: ', '') });
  if (msg.includes('BAD_REQUEST')) return res.status(400).json({ error: msg.replace('BAD_REQUEST: ', '') });

  console.error('[BillingController]', error);
  return res.status(500).json({ error: 'Internal server error' });
}

// ---------------------------------------------------------------------------
// Controller — all routes are scoped to :workspaceId
// ---------------------------------------------------------------------------

export class BillingController {

  // POST /workspaces/:workspaceId/billing/create-checkout-session
  static async createCheckoutSession(req: AuthRequest, res: Response) {
  try {
    const { workspaceId } = req.params;
    const { planName, billingCycle = 'MONTHLY' } = req.body as {
      planName:      'PRO' | 'BUSINESS';
      billingCycle?: BillingCycle;
    };

    if (!planName || !['PRO', 'BUSINESS'].includes(planName)) {
      return res.status(400).json({ error: 'planName must be PRO or BUSINESS' });
    }

    // ← fetch slug so service can build correct redirect URLs
    const workspace = await prisma.workspace.findUniqueOrThrow({
      where:  { id: workspaceId },
      select: { slug: true },
    });

    const url = await BillingService.createCheckoutSession({
      workspaceId,
      workspaceSlug: workspace.slug,  // ← pass slug
      ownerId:       req.user!!.id,
      planName,
      billingCycle,
    });

    res.json({ success: true, data: { url } });
  } catch (err) {
    return handleBillingError(res, err);
  }
}

static async createPortalSession(req: AuthRequest, res: Response) {
  try {
    const { workspaceId } = req.params;

    const workspace = await prisma.workspace.findUniqueOrThrow({
      where:  { id: workspaceId },
      select: { slug: true },
    });

    const url = await BillingService.createPortalSession({
      workspaceId,
      workspaceSlug: workspace.slug,  // ← pass slug
      ownerId:       req.user!!.id,
    });
    return res.json({ success: true, data: { url } });  // ← also fix this to match your api client pattern
  } catch (err) {
    return handleBillingError(res, err);
  }
}

  // GET /workspaces/:workspaceId/billing/subscription
  static async getSubscription(req: AuthRequest, res: Response) {
    try {
      const sub = await BillingService.getWorkspaceSubscription(req.params.workspaceId);
      // FREE workspaces have no subscription row
      return res.json({success: true, data: sub ?? { workspaceId: req.params.workspaceId, planName: 'FREE', status: 'ACTIVE' }});
    } catch (err) {
      return handleBillingError(res, err);
    }
  }

  // POST /workspaces/:workspaceId/billing/change-plan
  static async changePlan(req: AuthRequest, res: Response) {
    try {
      const { newPlanName, billingCycle } = req.body as {
        newPlanName:   'FREE' | 'PRO' | 'BUSINESS';
        billingCycle?: BillingCycle;
      };

      if (!newPlanName || !['FREE', 'PRO', 'BUSINESS'].includes(newPlanName)) {
        return res.status(400).json({ error: 'Invalid newPlanName' });
      }

      const result = await BillingService.changePlan({
        workspaceId: req.params.workspaceId,
        ownerId:     req.user!!.id,
        newPlanName,
        billingCycle,
      });

      return res.json(result);
    } catch (err) {
      return handleBillingError(res, err);
    }
  }

  // POST /workspaces/:workspaceId/billing/cancel-subscription
  static async cancelSubscription(req: AuthRequest, res: Response) {
    try {
      const { immediately = false, reason } = req.body as {
        immediately?: boolean;
        reason?:      string;
      };

      const result = await BillingService.cancelSubscription({
        workspaceId: req.params.workspaceId,
        ownerId:     req.user!!.id,
        immediately,
        reason,
      });

      return res.json(result);
    } catch (err) {
      return handleBillingError(res, err);
    }
  }

  // POST /workspaces/:workspaceId/billing/reactivate-subscription
  static async reactivateSubscription(req: AuthRequest, res: Response) {
    try {
      await BillingService.reactivateSubscription(req.params.workspaceId, req.user!!.id);
      return res.json({ reactivated: true });
    } catch (err) {
      return handleBillingError(res, err);
    }
  }

  // GET /workspaces/:workspaceId/billing/invoices
static async getInvoices(req: AuthRequest, res: Response) {
  try {
    const limit    = Math.min(Number(req.query.limit) || 20, 100);
    const invoices = await BillingService.getInvoices(req.params.workspaceId, req.user!!.id, limit);
    console.log(invoices)
    return res.json({ success: true, data: invoices });  // ← wrap in data like other endpoints
  } catch (err) {
    return handleBillingError(res, err);
  }
}
}