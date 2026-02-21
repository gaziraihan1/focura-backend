/**
 * calendar.controller.ts
 * Responsibility: HTTP layer for the Calendar domain.
 *
 * Each handler does exactly three things:
 *  1. Parse + validate the request via a Zod schema.
 *  2. Call the appropriate service.
 *  3. Send the response.
 *
 * Improvements over the original:
 *  - ZodError handling extracted to `handleError` — not repeated 7× inline.
 *  - Zod schemas live in calendar.validators.ts — not inline here.
 *  - All handlers are plain arrow functions (no static class needed for Express).
 */

import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { CalendarAggregation }    from './calendar.aggregation.js';
import { CalendarInsightsService } from './calendar.insights.js';
import { CalendarQuery }          from './calendar.query.js';
import { CalendarMutation }       from './calendar.mutation.js';
import {
  calendarRangeSchema,
  createGoalCheckpointSchema,
  recalculateSchema,
} from './calendar.validators.js';

// ─── Shared error handler ─────────────────────────────────────────────────────

function handleError(res: Response, label: string, error: unknown): Response {
  console.error(`${label}:`, error);

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors:  error.issues,
    });
  }

  return res.status(500).json({
    success: false,
    message: `Failed to ${label.toLowerCase()}`,
  });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /calendar/aggregates
 * Returns CalendarDayAggregate rows for the requested date range.
 * Automatically computes missing days on the fly.
 */
export const getCalendarAggregates = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { workspaceId, startDate, endDate } = calendarRangeSchema.parse(req.query);

    const aggregates = await CalendarAggregation.getOrComputeAggregates({
      userId, workspaceId, startDate, endDate,
    });

    return res.json({ success: true, data: aggregates });
  } catch (error) {
    return handleError(res, 'fetch calendar aggregates', error);
  }
};

/**
 * GET /calendar/insights
 * Returns capacity insights and burnout risk for the date range.
 */
export const getCalendarInsights = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { workspaceId, startDate, endDate } = calendarRangeSchema.parse(req.query);

    const insights = await CalendarInsightsService.getInsights(
      userId, workspaceId, startDate, endDate,
    );

    return res.json({ success: true, data: insights });
  } catch (error) {
    return handleError(res, 'fetch calendar insights', error);
  }
};

/**
 * GET /calendar/system-events
 * Returns system-generated calendar events for the date range.
 */
export const getSystemEvents = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { workspaceId, startDate, endDate } = calendarRangeSchema.parse(req.query);

    const events = await CalendarQuery.getSystemEvents(
      userId, workspaceId, startDate, endDate,
    );

    return res.json({ success: true, data: events });
  } catch (error) {
    return handleError(res, 'fetch system events', error);
  }
};

/**
 * GET /calendar/goals
 * Returns goal checkpoints for the date range.
 */
export const getGoalCheckpoints = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { workspaceId, startDate, endDate } = calendarRangeSchema.parse(req.query);

    const goals = await CalendarQuery.getGoalCheckpoints(
      userId, workspaceId, startDate, endDate,
    );

    return res.json({ success: true, data: goals });
  } catch (error) {
    return handleError(res, 'fetch goal checkpoints', error);
  }
};

/**
 * POST /calendar/goals
 * Creates a new goal checkpoint.
 */
export const createGoalCheckpoint = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const data   = createGoalCheckpointSchema.parse(req.body);

    const goal = await CalendarMutation.createGoalCheckpoint({ userId, ...data });

    return res.status(201).json({
      success: true,
      data:    goal,
      message: 'Goal checkpoint created successfully',
    });
  } catch (error) {
    return handleError(res, 'create goal checkpoint', error);
  }
};

/**
 * POST /calendar/recalculate
 * Manually triggers an aggregate recalculation for a specific day.
 */
export const recalculateAggregate = async (req: AuthRequest, res: Response) => {
  try {
    const userId              = req.user!.id;
    const { workspaceId, date } = recalculateSchema.parse(req.body);

    await CalendarAggregation.recalculateDay(userId, workspaceId, date);

    return res.json({ success: true, message: 'Aggregate recalculated successfully' });
  } catch (error) {
    return handleError(res, 'recalculate aggregate', error);
  }
};

/**
 * POST /calendar/initialize
 * Bootstraps default capacity and work schedule for a user.
 */
export const initializeUserSettings = async (req: AuthRequest, res: Response) => {
  try {
    await CalendarMutation.initializeUserSettings(req.user!.id);

    return res.json({
      success: true,
      message: 'User calendar settings initialized successfully',
    });
  } catch (error) {
    return handleError(res, 'initialize user settings', error);
  }
};