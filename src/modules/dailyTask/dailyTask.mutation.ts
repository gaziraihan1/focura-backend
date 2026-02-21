/**
 * dailyTask.mutation.ts
 * Responsibility: Write operations for the DailyTask domain.
 *
 * Each mutation follows a clean sequence:
 *  1. Authorize (DailyTaskAccess)
 *  2. Validate business rules
 *  3. Write to DB
 *  4. Log activity (DailyTaskActivity) — fire-and-forget, never throws
 *
 * Rules:
 *  - No HTTP concepts, no response formatting.
 *  - No inline activity.create calls — delegated to DailyTaskActivity.
 */

import { prisma } from '../../index.js';
import type { AddDailyTaskParams, RemoveDailyTaskParams, ClearExpiredResult } from './dailyTask.types.js';
import { taskFullInclude } from './dailyTask.selects.js';
import { DailyTaskAccess } from './dailyTask.access.js';
import { DailyTaskActivity } from './dailyTask.activity.js';

/** Returns the start and end of the day containing `date` */
function dayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export const DailyTaskMutation = {
  /**
   * Adds a task to the user's daily list as PRIMARY or SECONDARY.
   *
   * Business rules enforced:
   *  - User must have access to the task.
   *  - Completed tasks cannot be added.
   *  - Only one PRIMARY task per day per user.
   *  - If the same task already exists for the day, updates its type instead.
   */
  async addDailyTask(params: AddDailyTaskParams) {
    const date          = params.date ?? new Date();
    const { start, end } = dayBounds(date);

    // 1. Authorize — throws if no access
    const task = await DailyTaskAccess.assertTaskAccess(params.userId, params.taskId);

    // 2. Business rules
    if (task.status === 'COMPLETED') {
      throw new Error('Cannot add a completed task to daily tasks');
    }

    if (params.type === 'PRIMARY') {
      const existingPrimary = await prisma.dailyTask.findFirst({
        where: {
          userId: params.userId,
          type:   'PRIMARY',
          date:   { gte: start, lt: end },
        },
      });

      if (existingPrimary) {
        throw new Error(
          'You already have a primary task for today. Remove it first or choose secondary.',
        );
      }
    }

    // 3. Upsert — update type if already exists, create if not
    const existing = await prisma.dailyTask.findFirst({
      where: {
        userId: params.userId,
        taskId: params.taskId,
        date:   { gte: start, lt: end },
      },
    });

    if (existing) {
      // Same type — no-op
      if (existing.type === params.type) return existing;

      // Different type — update
      return prisma.dailyTask.update({
        where:   { id: existing.id },
        data:    { type: params.type },
        include: { task: { include: taskFullInclude } },
      });
    }

    // 4. Create new daily task record
    const dailyTask = await prisma.dailyTask.create({
      data: {
        userId: params.userId,
        taskId: params.taskId,
        type:   params.type,
        date:   start,
      },
      include: { task: { include: taskFullInclude } },
    });

    // 5. Log activity (non-blocking)
    const workspaceId = task.project?.workspace?.id;
    if (workspaceId) {
      void DailyTaskActivity.logAdded({
        userId:      params.userId,
        taskId:      params.taskId,
        taskTitle:   task.title,
        workspaceId,
        type:        params.type,
      });
    }

    return dailyTask;
  },

  /**
   * Removes a task from the user's daily list for the given day.
   * Throws if no matching daily task record exists.
   */
  async removeDailyTask(params: RemoveDailyTaskParams) {
    const date           = params.date ?? new Date();
    const { start, end } = dayBounds(date);

    const dailyTask = await prisma.dailyTask.findFirst({
      where: {
        userId: params.userId,
        taskId: params.taskId,
        date:   { gte: start, lt: end },
      },
      include: {
        task: {
          include: {
            project: {
              select: { workspace: { select: { id: true } } },
            },
          },
        },
      },
    });

    if (!dailyTask) {
      throw new Error('Daily task not found');
    }

    await prisma.dailyTask.delete({ where: { id: dailyTask.id } });

    // Log activity (non-blocking)
    const workspaceId = dailyTask.task.project?.workspace?.id;
    if (workspaceId) {
      void DailyTaskActivity.logRemoved({
        userId:      params.userId,
        taskId:      params.taskId,
        taskTitle:   dailyTask.task.title,
        workspaceId,
        type:        dailyTask.type as 'PRIMARY' | 'SECONDARY',
      });
    }
  },

  /**
   * Bulk-deletes all daily tasks with a date before today.
   * Designed to be called by a cron job — not user-triggered.
   */
  async clearExpiredDailyTasks(): Promise<ClearExpiredResult> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await prisma.dailyTask.deleteMany({
      where: { date: { lt: today } },
    });

    return { deletedCount: result.count };
  },
};