
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

export const completeSession = async (req: AuthRequest, res: Response) => {
  try {
    const session = await FocusSessionMutation.completeSession(
      { sessionId: req.params.id, userId: req.user!.id },

      async ({ startedAt, workspaceId }) => {
        await CalendarAggregation.recalculateDay(req.user!.id, workspaceId, startedAt);
      },
    );

    return res.json({ success: true, data: session, message: 'Focus session completed' });
  } catch (error) {
    handleError(res, 'complete focus session', error);
  }
};

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

export const getActiveSession = async (req: AuthRequest, res: Response) => {
  try {
    const session = await FocusSessionQuery.getActiveSession(req.user!.id);
    return res.json({ success: true, data: session });
  } catch (error) {
    handleError(res, 'get active session', error);
  }
};

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