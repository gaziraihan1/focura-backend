import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { ActivityService } from '../services/activity.service.js';
import { ActivityType, EntityType } from '@prisma/client';
// import { ActivityService } from '../services/activity.service.js';

/**
 * Get all activities for the authenticated user
 */
export const getActivities = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      workspaceId, 
      entityType, 
      action, 
      limit = '50', 
      offset = '0',
      startDate,
      endDate,
    } = req.query;

    console.log('📋 GET /api/activities called');
    console.log('  User:', req.user?.email);
    console.log('  Query params:', req.query);

    const filters = {
      workspaceId: workspaceId as string | undefined,
      entityType: entityType as EntityType | undefined,
      action: action as ActivityType | undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const activities = await ActivityService.getUserActivities(userId, filters);

    res.json({
      success: true,
      data: activities,
      meta: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: activities.length === filters.limit,
      },
    });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get activities for a specific workspace
 */
export const getWorkspaceActivities = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const { limit = '50', offset = '0', action, entityType } = req.query;

    console.log('📋 GET /api/activities/workspace/:workspaceId called');
    console.log('  User:', req.user?.email);
    console.log('  WorkspaceId:', workspaceId);

    // Check workspace access
    const hasAccess = await ActivityService.checkWorkspaceAccess(
      req.user!.id,
      workspaceId
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this workspace',
      });
    }

    const filters = {
      action: action as ActivityType,
      entityType: entityType as EntityType,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const activities = await ActivityService.getWorkspaceActivities(
      workspaceId,
      filters
    );

    res.json({
      success: true,
      data: activities,
      meta: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: activities.length === filters.limit,
      },
    });
  } catch (error) {
    console.error('Get workspace activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace activities',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get activities for a specific task
 */
export const getTaskActivities = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    console.log('📋 GET /api/activities/task/:taskId called');
    console.log('  TaskId:', taskId);

    // Check task access
    const hasAccess = await ActivityService.checkTaskAccess(
      req.user!.id,
      taskId
    );

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to this task',
      });
    }

    const filters = {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const activities = await ActivityService.getTaskActivities(taskId, filters);

    res.json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error('Get task activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task activities',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

export const deleteActivity = async (req: AuthRequest, res: Response) => {
  try {
    const { activityId } = req.params;

    console.log('🗑️ DELETE /api/activities/:activityId called');
    console.log('  ActivityId:', activityId);

    await ActivityService.deleteActivity(activityId, req.user!.id);

    res.json({
      success: true,
      message: 'Activity deleted successfully',
    });
  } catch (error) {
    console.error('Delete activity error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: 'Activity not found',
      });
    }

    if (error instanceof Error && error.message.includes('permission')) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this activity',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete activity',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Clear all activities (with optional filters)
 */
export const clearActivities = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId, before } = req.query;

    console.log('🗑️ DELETE /api/activities/clear/all called');
    console.log('  Query params:', req.query);

    const filters = {
      workspaceId: workspaceId as string | undefined,
      before: before ? new Date(before as string) : undefined,
    };

    const deletedCount = await ActivityService.clearUserActivities(
      req.user!.id,
      filters
    );

    res.json({
      success: true,
      message: `Successfully cleared ${deletedCount} activities`,
      data: { deletedCount },
    });
  } catch (error) {
    console.error('Clear activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear activities',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};