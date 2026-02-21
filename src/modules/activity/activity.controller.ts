/**
 * activity.controller.ts
 * Responsibility: HTTP layer for the Activity domain.
 *
 * Each handler does exactly three things — nothing more:
 *  1. Parse and validate the incoming request (params, query, body).
 *  2. Call the appropriate service (Query / Mutation / Analytics).
 *  3. Format and send the HTTP response.
 *
 * Rules:
 *  - No Prisma calls. No SQL. No business logic.
 *  - No auth checks embedded here — access guards live in ActivityAccess
 *    and are called explicitly before the service call.
 *  - console.log removed in favour of structured logging patterns;
 *    replace with your logger (winston/pino) as needed.
 */

import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import type { ActivityType, EntityType } from './activity.types.js';
import { ActivityQuery }    from './activity.query.js';
import { ActivityMutation } from './activity.mutation.js';
import { ActivityAccess }   from './activity.access.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parses a query string value to int, with a safe fallback. */
const toInt = (value: unknown, fallback: number): number => {
  const parsed = parseInt(value as string, 10);
  return isNaN(parsed) ? fallback : parsed;
};

/** Sends a typed error response and returns void for early-return pattern. */
const sendError = (
  res: Response,
  status: number,
  message: string,
  error?: unknown,
) => {
  res.status(status).json({
    success: false,
    message,
    ...(error instanceof Error && { error: error.message }),
  });
};

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /activities
 * Returns all activities visible to the authenticated user.
 */
export const getActivities = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { workspaceId, entityType, action, startDate, endDate } = req.query;
    const limit  = toInt(req.query.limit,  50);
    const offset = toInt(req.query.offset, 0);

    const activities = await ActivityQuery.getUserActivities(userId, {
      workspaceId:  workspaceId  as string     | undefined,
      entityType:   entityType   as EntityType | undefined,
      action:       action       as ActivityType | undefined,
      startDate:    startDate ? new Date(startDate as string) : undefined,
      endDate:      endDate   ? new Date(endDate   as string) : undefined,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: activities,
      meta: { limit, offset, hasMore: activities.length === limit },
    });
  } catch (error) {
    sendError(res, 500, 'Failed to fetch activities', error);
  }
};

/**
 * GET /activities/workspace/:workspaceId
 * Returns activities scoped to a specific workspace.
 */
export const getWorkspaceActivities = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { action, entityType } = req.query;
    const limit  = toInt(req.query.limit,  50);
    const offset = toInt(req.query.offset, 0);

    const hasAccess = await ActivityAccess.canAccessWorkspace(req.user!.id, workspaceId);
    if (!hasAccess) {
      return sendError(res, 403, 'You do not have access to this workspace');
    }

    const activities = await ActivityQuery.getWorkspaceActivities(workspaceId, {
      action:     action     as ActivityType | undefined,
      entityType: entityType as EntityType  | undefined,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: activities,
      meta: { limit, offset, hasMore: activities.length === limit },
    });
  } catch (error) {
    sendError(res, 500, 'Failed to fetch workspace activities', error);
  }
};

/**
 * GET /activities/task/:taskId
 * Returns activities scoped to a specific task.
 */
export const getTaskActivities = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const limit  = toInt(req.query.limit,  50);
    const offset = toInt(req.query.offset, 0);

    const hasAccess = await ActivityAccess.canAccessTask(req.user!.id, taskId);
    if (!hasAccess) {
      return sendError(res, 403, 'You do not have access to this task');
    }

    const activities = await ActivityQuery.getTaskActivities(taskId, { limit, offset });

    res.json({
      success: true,
      data: activities,
      meta: { limit, offset, hasMore: activities.length === limit },
    });
  } catch (error) {
    sendError(res, 500, 'Failed to fetch task activities', error);
  }
};

/**
 * DELETE /activities/clear
 * Bulk-deletes the authenticated user's activities with optional filters.
 */
export const clearActivities = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, before } = req.query;

    const deletedCount = await ActivityMutation.clearUserActivities(req.user!.id, {
      workspaceId: workspaceId as string | undefined,
      before:      before ? new Date(before as string) : undefined,
    });

    res.json({
      success: true,
      message: `Successfully cleared ${deletedCount} activities`,
      data: { deletedCount },
    });
  } catch (error) {
    sendError(res, 500, 'Failed to clear activities', error);
  }
};

/**
 * DELETE /activities/:activityId
 * Deletes a single activity. Authorization enforced inside ActivityMutation.
 */
export const deleteActivity = async (req: AuthRequest, res: Response) => {
  try {
    const { activityId } = req.params;

    await ActivityMutation.deleteActivity(activityId, req.user!.id);

    res.json({ success: true, message: 'Activity deleted successfully' });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not found'))   return sendError(res, 404, 'Activity not found');
      if (error.message.includes('permission'))  return sendError(res, 403, error.message);
    }
    sendError(res, 500, 'Failed to delete activity', error);
  }
};