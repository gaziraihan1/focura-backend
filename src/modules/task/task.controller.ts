import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { TaskQuery }    from './task.query.js';
import { TaskMutation } from './task.mutation.js';
import { TaskActivity } from './task.activity.js';
import { TaskNotifications } from './task.notifications.js';
import { CalendarAggregation } from '../calendar/calendar.aggregation.js';
import {
  getTasksQuerySchema,
  getTaskStatsQuerySchema,
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  addCommentSchema,
} from './task.validators.js';
import {
  getPersonalQuotaInfo,
  getWorkspaceQuotaInfo,
} from './task.limits.js';


function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    return;
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (msg === 'Task not found') {
      res.status(404).json({ success: false, message: msg });
    } else if (msg.includes('permission') || msg.includes('access')) {
      res.status(403).json({ success: false, message: msg });
    } else if (msg.includes('required') || msg.includes('Invalid')) {
      res.status(400).json({ success: false, message: msg });
    } else {
      console.error(`${label} error:`, error);
      res.status(500).json({ success: false, message: `Failed to ${label}` });
    }
    return;
  }

  console.error(`${label} error:`, error);
  res.status(500).json({ success: false, message: `Failed to ${label}` });
}

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const query = getTasksQuerySchema.parse(req.query);
    const labelIds = query.labelIds ? query.labelIds.split(',').filter(Boolean) : undefined;

    const result = await TaskQuery.getTasks(
      { userId: req.user!.id, ...query, labelIds },
      { page: query.page, pageSize: query.pageSize },
      { sortBy: query.sortBy, sortOrder: query.sortOrder },
    );

    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error) {
    handleError(res, 'fetch tasks', error);
  }
};

export const getTaskStats = async (req: AuthRequest, res: Response) => {
  try {
    const query = getTaskStatsQuerySchema.parse(req.query);
    const stats = await TaskQuery.getTaskStats({ userId: req.user!.id, ...query });
    res.json({ success: true, data: stats });
  } catch (error) {
    handleError(res, 'fetch task statistics', error);
  }
};
export const getTaskOverview = async (req: AuthRequest, res: Response) => {
  try {
    const overview = await TaskQuery.getTaskOverview(req.params.id, req.user!.id);
    res.json({ success: true, data: overview });
  } catch (error) {
    handleError(res, 'fetch task overview', error);
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const data = createTaskSchema.parse(req.body);

    const task = await TaskMutation.createTask(
      { ...data, createdById: req.user!.id },
      async ({ task, assigneeIds }) => {
        if (task.workspaceId) {
          void TaskActivity.logCreated({
            taskId:        task.id,
            taskTitle:     task.title,
            userId:        req.user!.id,
            workspaceId:   task.workspaceId,
            focusRequired: data.focusRequired,
            energyType:    data.energyType,
            intent:        data.intent,
          });
        }
        if (assigneeIds.length > 0) {
          void TaskNotifications.notifyNewAssignees({
            taskId:      task.id,
            taskTitle:   task.title,
            assigneeIds,
            creatorId:   req.user!.id,
          });
        }
        if (task.dueDate) {
          void CalendarAggregation.recalculateDay(req.user!.id, task.workspaceId || undefined, task.dueDate);
        }
      },
    );

    res.status(201).json({ success: true, message: 'Task created successfully', data: task });
  } catch (error) {
    handleError(res, 'create task', error);
  }
};

export const getTask = async (req: AuthRequest, res: Response) => {
  try {
    const task = await TaskQuery.getTaskById(req.params.id, req.user!.id);
    res.json({ success: true, data: task });
  } catch (error) {
    handleError(res, 'fetch task', error);
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const data = updateTaskSchema.parse(req.body);
    const oldTask = await TaskQuery.getTaskById(req.params.id, req.user!.id);

    const task = await TaskMutation.updateTask(
      req.params.id, req.user!.id, data,
      async ({ task, oldStatus, newStatus, addedAssigneeIds }) => {
        if (task.workspaceId) {
          if (newStatus && oldStatus && newStatus !== oldStatus) {
            void TaskActivity.logStatusChanged({
              taskId: task.id, taskTitle: task.title, userId: req.user!.id,
              workspaceId: task.workspaceId, oldStatus, newStatus,
            });
          } else {
            void TaskActivity.logUpdated({
              taskId: task.id, taskTitle: task.title,
              userId: req.user!.id, workspaceId: task.workspaceId, changes: data,
            });
          }
        }
        if (addedAssigneeIds.length > 0) {
          void TaskNotifications.notifyAddedAssignees({
            taskId: task.id, taskTitle: task.title, addedIds: addedAssigneeIds, updaterId: req.user!.id,
          });
        }
        if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
          void TaskNotifications.notifyTaskCompleted({ taskId: task.id, taskTitle: task.title, userId: req.user!.id });
        }
        const dates = new Set<Date>();
        if (oldTask.dueDate) dates.add(oldTask.dueDate);
        if (task.dueDate)    dates.add(task.dueDate);
        for (const date of dates) {
          void CalendarAggregation.recalculateDay(req.user!.id, task.workspaceId || undefined, date);
        }
      },
    );

    res.json({ success: true, message: 'Task updated successfully', data: task });
  } catch (error) {
    handleError(res, 'update task', error);
  }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = updateTaskStatusSchema.parse(req.body);

    const task = await TaskMutation.updateTaskStatus(
      req.params.id, req.user!.id, status,
      async ({ task, oldStatus, newStatus }) => {
        if (task.workspaceId && newStatus && oldStatus && newStatus !== oldStatus) {
          void TaskActivity.logStatusChanged({
            taskId: task.id, taskTitle: task.title, userId: req.user!.id,
            workspaceId: task.workspaceId, oldStatus, newStatus,
          });
        }
        if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
          void TaskNotifications.notifyTaskCompleted({ taskId: task.id, taskTitle: task.title, userId: req.user!.id });
        }
      },
    );

    res.json({ success: true, data: task });
  } catch (error) {
    handleError(res, 'update task status', error);
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const task = await TaskQuery.getTaskById(req.params.id, req.user!.id);

    await TaskMutation.deleteTask(
      req.params.id, req.user!.id,
      async ({ task: deletedTask }) => {
        if (deletedTask.project?.workspaceId) {
          void TaskActivity.logDeleted({
            taskId: deletedTask.id, taskTitle: deletedTask.title, userId: req.user!.id,
            workspaceId: deletedTask.project.workspaceId, status: deletedTask.status, priority: deletedTask.priority,
          });
        }
        if (task.dueDate) {
          void CalendarAggregation.recalculateDay(req.user!.id, task.workspaceId || undefined, task.dueDate);
        }
      },
    );

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    handleError(res, 'delete task', error);
  }
};


/**
 * GET /tasks/quota/personal
 * Returns the current user's personal task creation quota for today.
 */
export const getPersonalQuota = async (req: AuthRequest, res: Response) => {
  try {
    const info = await getPersonalQuotaInfo(req.user!.id);
    res.json({ success: true, data: info });
  } catch (error) {
    console.error('getPersonalQuota error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch quota info' });
  }
};

/**
 * GET /tasks/quota/workspace/:workspaceId
 * Returns workspace task creation quota for today.
 * - All members see totals + their own usage.
 * - OWNER / ADMIN also see per-member breakdown.
 */
export const getWorkspaceQuota = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    if (!workspaceId) {
      res.status(400).json({ success: false, message: 'workspaceId is required' });
      return;
    }

    const info = await getWorkspaceQuotaInfo(workspaceId, req.user!.id);
    res.json({ success: true, data: info });
  } catch (error) {
    console.error('getWorkspaceQuota error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch workspace quota info' });
  }
};