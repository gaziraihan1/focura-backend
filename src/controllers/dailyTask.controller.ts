import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { DailyTaskService } from '../services/dailyTask.service.js';

/**
 * Get daily tasks for the authenticated user
 * GET /api/daily-tasks?date=2026-02-09
 */
export const getDailyTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    
    console.log('📅 GET /api/daily-tasks called');
    console.log('  User:', req.user?.email);
    console.log('  Date:', date);

    // Parse date or use today
    const targetDate = date ? new Date(date as string) : new Date();

    const result = await DailyTaskService.getDailyTasks({
      userId: req.user!.id,
      date: targetDate,
    });

    res.json({
      success: true,
      data: {
        date: targetDate,
        primaryTask: result.primaryTask?.task || null,
        secondaryTasks: result.secondaryTasks.map(dt => dt.task) || [],
      },
    });
  } catch (error) {
    console.error('Get daily tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily tasks',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Add a task to daily tasks (PRIMARY or SECONDARY)
 * POST /api/daily-tasks
 * Body: { taskId: string, type: 'PRIMARY' | 'SECONDARY', date?: string }
 */
export const addDailyTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, type, date } = req.body;

    console.log('➕ POST /api/daily-tasks called');
    console.log('  User:', req.user?.email);
    console.log('  Task ID:', taskId);
    console.log('  Type:', type);

    // Validation
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required',
      });
    }

    if (!type || !['PRIMARY', 'SECONDARY'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Type must be either PRIMARY or SECONDARY',
      });
    }

    const targetDate = date ? new Date(date) : new Date();

    const dailyTask = await DailyTaskService.addDailyTask({
      userId: req.user!.id,
      taskId,
      type,
      date: targetDate,
    });

    res.status(201).json({
      success: true,
      message: `Task added to ${type.toLowerCase()} tasks`,
      data: dailyTask,
    });
  } catch (error) {
    console.error('Add daily task error:', error);

    if (error instanceof Error) {
      const message = error.message;

      if (message.includes('already have a primary task')) {
        return res.status(409).json({
          success: false,
          message: message,
        });
      }

      if (message.includes('not found') || message.includes('do not have access')) {
        return res.status(404).json({
          success: false,
          message: message,
        });
      }

      if (message.includes('completed task')) {
        return res.status(400).json({
          success: false,
          message: message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: 'Failed to add daily task',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Remove a task from daily tasks
 * DELETE /api/daily-tasks/:taskId
 */
export const removeDailyTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { date } = req.query;

    console.log('➖ DELETE /api/daily-tasks/:taskId called');
    console.log('  User:', req.user?.email);
    console.log('  Task ID:', taskId);

    const targetDate = date ? new Date(date as string) : new Date();

    const result = await DailyTaskService.removeDailyTask({
      userId: req.user!.id,
      taskId,
      date: targetDate,
    });

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Remove daily task error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to remove daily task',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Clear expired daily tasks (admin/cron endpoint)
 * POST /api/daily-tasks/clear-expired
 */
export const clearExpiredDailyTasks = async (req: AuthRequest, res: Response) => {
  try {
    console.log('🗑️ POST /api/daily-tasks/clear-expired called');
    console.log('  User:', req.user?.email);

    const result = await DailyTaskService.clearExpiredDailyTasks();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Clear expired daily tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear expired daily tasks',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Get daily task statistics
 * GET /api/daily-tasks/stats?startDate=2026-01-01&endDate=2026-01-31
 */
export const getDailyTaskStats = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    console.log('📊 GET /api/daily-tasks/stats called');
    console.log('  User:', req.user?.email);

    // Default to last 30 days if not provided
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = await DailyTaskService.getDailyTaskStats({
      userId: req.user!.id,
      startDate: start,
      endDate: end,
    });

    res.json({
      success: true,
      data: {
        ...stats,
        startDate: start,
        endDate: end,
      },
    });
  } catch (error) {
    console.error('Get daily task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily task statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};