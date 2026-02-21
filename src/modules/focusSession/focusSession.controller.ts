/**
 * focusSession.controller.ts
 * Responsibility: HTTP layer for the FocusSession domain.
 *
 * Key improvements over the original:
 *
 * 1. Error code mapping — replaces fragile string equality checks:
 *    BEFORE: (error as Error).message === 'SESSION_NOT_FOUND'
 *    AFTER:  error.message === FocusSessionError.SESSION_NOT_FOUND
 *
 * 2. Calendar decoupling — the controller provides the onComplete callback
 *    to completeSession. FocusSession module never imports Calendar module.
 *
 * 3. Missing /stats route — getStats was implemented in the controller but
 *    never registered in the routes file. Fixed in focusSession.routes.ts.
 *
 * 4. Static class → plain functions — simpler, no `this` binding issues with Express.
 */

import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { FocusSessionQuery }     from './focusSession.query.js';
import { FocusSessionMutation }  from './focusSession.mutation.js';
import { FocusSessionAnalytics } from './focusSession.analytics.js';
import { FocusSessionError }     from './focusSession.types.js';
import { CalendarAggregation }   from '../calendar/calendar.aggregation.js';
import {
  startSessionSchema,
  getHistorySchema,
  getStatsSchema,
} from './focusSession.validators.js';

// ─── Error handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    return;
  }

  if (error instanceof Error) {
    switch (error.message) {
      case FocusSessionError.USER_HAS_ACTIVE_SESSION:
      case FocusSessionError.SESSION_ALREADY_COMPLETED:
        res.status(400).json({ success: false, message: error.message });
        return;
      case FocusSessionError.SESSION_NOT_FOUND:
        res.status(404).json({ success: false, message: 'Focus session not found' });
        return;
    }
  }

  console.error(`${label} error:`, error);
  res.status(500).json({ success: false, message: `Failed to ${label}` });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /focus-sessions/start
 */
export const startSession = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const body   = startSessionSchema.parse(req.body);

    const session = await FocusSessionMutation.startSession({ userId, ...body });

    return res.status(201).json({
      success: true,
      data:    session,
      message: 'Focus session started',
    });
  } catch (error) {
    // USER_HAS_ACTIVE_SESSION — return the active session in the body
    if (error instanceof Error &&
        error.message === FocusSessionError.USER_HAS_ACTIVE_SESSION) {
      const active = await FocusSessionQuery.getActiveSession(req.user!.id);
      return res.status(400).json({
        success: false,
        message: 'You already have an active focus session',
        data:    active,
      });
    }
    handleError(res, 'start focus session', error);
  }
};

/**
 * POST /focus-sessions/:id/complete
 * Provides a calendar recalculation callback — keeps the two modules decoupled.
 */
export const completeSession = async (req: AuthRequest, res: Response) => {
  try {
    const session = await FocusSessionMutation.completeSession(
      { sessionId: req.params.id, userId: req.user!.id },

      // onComplete callback — calendar module dependency stays here, not in FocusSession
      async ({ startedAt, workspaceId }) => {
        await CalendarAggregation.recalculateDay(req.user!.id, workspaceId, startedAt);
      },
    );

    return res.json({ success: true, data: session, message: 'Focus session completed' });
  } catch (error) {
    handleError(res, 'complete focus session', error);
  }
};

/**
 * POST /focus-sessions/:id/cancel
 */
export const cancelSession = async (req: AuthRequest, res: Response) => {
  try {
    await FocusSessionMutation.cancelSession({
      sessionId: req.params.id,
      userId:    req.user!.id,
    });

    return res.json({ success: true, message: 'Focus session cancelled' });
  } catch (error) {
    handleError(res, 'cancel focus session', error);
  }
};

/**
 * GET /focus-sessions/active
 */
export const getActiveSession = async (req: AuthRequest, res: Response) => {
  try {
    const session = await FocusSessionQuery.getActiveSession(req.user!.id);
    return res.json({ success: true, data: session });
  } catch (error) {
    handleError(res, 'get active session', error);
  }
};

/**
 * GET /focus-sessions/history?limit=30
 */
export const getHistory = async (req: AuthRequest, res: Response) => {
  try {
    const { limit } = getHistorySchema.parse(req.query);

    const sessions = await FocusSessionQuery.getHistory({
      userId: req.user!.id,
      limit,
    });

    return res.json({ success: true, data: sessions });
  } catch (error) {
    handleError(res, 'get focus history', error);
  }
};

/**
 * GET /focus-sessions/stats?startDate=...&endDate=...
 * NOTE: This route existed in the controller but was missing from routes.ts — now fixed.
 */
export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = getStatsSchema.parse(req.query);
    const userId = req.user!.id;

    const [stats, focusStreak] = await Promise.all([
      FocusSessionAnalytics.getStats({ userId, startDate, endDate }),
      FocusSessionAnalytics.getFocusStreak(userId),
    ]);

    return res.json({
      success: true,
      data:    { ...stats, focusStreak },
    });
  } catch (error) {
    handleError(res, 'get focus statistics', error);
  }
};