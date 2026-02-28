
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