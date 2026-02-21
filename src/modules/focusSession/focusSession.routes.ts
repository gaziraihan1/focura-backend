/**
 * focusSession.routes.ts
 * Responsibility: Route definitions for the FocusSession domain.
 *
 * Two bugs fixed from the original:
 *
 * 1. Missing route — GET /stats was implemented in the controller
 *    but never registered here. It was completely unreachable.
 *
 * 2. Route order — specific named paths (/start, /active, /history, /stats)
 *    must come before param paths (/:id/complete, /:id/cancel).
 *    Express matches routes top-to-bottom: if /:id came first,
 *    "active" or "stats" would be captured as an :id param.
 */

import { Router } from 'express';
import {
  startSession,
  completeSession,
  cancelSession,
  getActiveSession,
  getHistory,
  getStats,
} from './focusSession.controller.js';

const router = Router();

// ─── Named paths first (must come before /:id routes) ─────────────────────────
router.post('/start',   startSession);
router.get('/active',   getActiveSession);
router.get('/history',  getHistory);
router.get('/stats',    getStats);    // ← was missing in original

// ─── Param routes ─────────────────────────────────────────────────────────────
router.post('/:id/complete', completeSession);
router.post('/:id/cancel',   cancelSession);

export default router;