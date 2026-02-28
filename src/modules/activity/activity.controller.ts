
import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import type { ActivityType, EntityType } from './activity.types.js';
import { ActivityQuery }    from './activity.query.js';
import { ActivityMutation } from './activity.mutation.js';
import { ActivityAccess }   from './activity.access.js';

const toInt = (value: unknown, fallback: number): number => {
  const parsed = parseInt(value as string, 10);
  return isNaN(parsed) ? fallback : parsed;
};

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