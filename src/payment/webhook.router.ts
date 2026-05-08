// backend/src/payment/webhook.router.ts
//
// Single webhook endpoint. The active provider's verifyAndParseWebhook()
// handles signature verification — the router itself is provider-agnostic.
//
// IMPORTANT: must be registered BEFORE express.json() so req.body is raw Buffer.
// ─────────────────────────────────────────────────────────────────────────────

import { Router, raw } from 'express';
import { webhookHandler } from './webhook.handler.js';

const router = Router();

router.post(
  '/webhooks/billing',
  raw({ type: 'application/json' }),
  webhookHandler,
);

export default router;

// ---------------------------------------------------------------------------
// In app.ts:
//
//   import webhookRouter from './payment/webhook.router';
//   app.use(webhookRouter);                     ← BEFORE express.json()
//   app.use(express.json());
//   app.use('/workspaces/:workspaceId/billing', billingRouter);
//
// Stripe dashboard webhook URL:  https://yourdomain.com/webhooks/billing
// Paddle dashboard webhook URL:  https://yourdomain.com/webhooks/billing
// ---------------------------------------------------------------------------