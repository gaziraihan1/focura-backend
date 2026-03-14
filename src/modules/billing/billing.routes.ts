// backend/src/billing/billing.router.ts
// Mounted at /workspaces/:workspaceId/billing
// All routes sit under the workspace namespace so they naturally scope to one workspace.

import { Router }           from 'express';
import { BillingController } from './billing.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router({ mergeParams: true }); // mergeParams = inherit :workspaceId from parent

router.use(authenticate);

router.post('/create-checkout-session',  BillingController.createCheckoutSession);
router.post('/create-portal-session',    BillingController.createPortalSession);
router.get ('/subscription',             BillingController.getSubscription);
router.post('/change-plan',              BillingController.changePlan);
router.post('/cancel-subscription',      BillingController.cancelSubscription);
router.post('/reactivate-subscription',  BillingController.reactivateSubscription);
router.get ('/invoices',                 BillingController.getInvoices);

export default router;

// ---------------------------------------------------------------------------
// In your main app.ts, mount like this:
//
//   import workspaceBillingRouter from './billing/billing.router';
//   app.use('/workspaces/:workspaceId/billing', workspaceBillingRouter);
// ---------------------------------------------------------------------------