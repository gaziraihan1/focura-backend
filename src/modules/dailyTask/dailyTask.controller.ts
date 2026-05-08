
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { DailyTaskQuery }    from './dailyTask.query.js';
import { DailyTaskMutation } from './dailyTask.mutation.js';
import {
  getDailyTasksSchema,
  addDailyTaskSchema,
  removeDailyTaskSchema,
  dailyTaskStatsSchema,
} from './dailyTask.validators.js';

function mapErrorToStatus(message: string): number {
  if (message.includes('already have a primary task'))              return 409;
  if (message.includes('not found'))                                return 404;
  if (message.includes('do not have access'))                       return 404;
  if (message.includes('completed task'))                           return 400;
  return 500;
}

function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    return;
  }

  if (error instanceof Error) {
    const status = mapErrorToStatus(error.message);
    res.status(status).json({ success: false, message: error.message });
    return;
  }

  res.status(500).json({ success: false, message: `Failed to ${label}` });
}

export const getDailyTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { date } = getDailyTasksSchema.parse(req.query);
    const targetDate = date ?? new Date();

    const result = await DailyTaskQuery.getDailyTasks({
      userId: req.user!.id,
      date:   targetDate,
    });

    res.json({
      success: true,
      data: {
        date:           targetDate,
        primaryTask:    result.primaryTask?.task   ?? null,
        secondaryTasks: result.secondaryTasks.map((dt) => dt.task),
      },
    });
  } catch (error) {
    handleError(res, 'fetch daily tasks', error);
  }
};

export const addDailyTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, type, date } = addDailyTaskSchema.parse(req.body);
    const targetDate = date ?? new Date();

    const dailyTask = await DailyTaskMutation.addDailyTask({
      userId: req.user!.id,
      taskId,
      type,
      date: targetDate,
    });

    res.status(201).json({
      success: true,
      message: `Task added to ${type.toLowerCase()} tasks`,
      data:    dailyTask,
    });
  } catch (error) {
    handleError(res, 'add daily task', error);
  }
};

export const removeDailyTask = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId }  = req.params;
    const { date }    = removeDailyTaskSchema.parse(req.query);
    const targetDate  = date ?? new Date();

    await DailyTaskMutation.removeDailyTask({
      userId: req.user!.id,
      taskId,
      date: targetDate,
    });

    res.json({ success: true, message: 'Daily task removed successfully' });
  } catch (error) {
    handleError(res, 'remove daily task', error);
  }
};

export const clearExpiredDailyTasks = async (req: AuthRequest, res: Response) => {
  try {
    const result = await DailyTaskMutation.clearExpiredDailyTasks();

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} expired daily tasks`,
      data:    result,
    });
  } catch (error) {
    handleError(res, 'clear expired daily tasks', error);
  }
};

export const getDailyTaskStats = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = dailyTaskStatsSchema.parse(req.query);

    const end   = endDate   ?? new Date();
    const start = startDate ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = await DailyTaskQuery.getDailyTaskStats({
      userId:    req.user!.id,
      startDate: start,
      endDate:   end,
    });

    res.json({
      success: true,
      data: { ...stats, startDate: start, endDate: end },
    });
  } catch (error) {
    handleError(res, 'fetch daily task statistics', error);
  }
};