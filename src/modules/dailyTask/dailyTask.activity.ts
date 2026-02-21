/**
 * dailyTask.activity.ts
 * Responsibility: Activity log entries specific to DailyTask mutations.
 *
 * Why a dedicated file instead of calling ActivityMutation directly:
 *  - The mutation file was calling `prisma.activity.create` inline inside
 *    `addDailyTask` and `removeDailyTask` — two different concerns in one function.
 *  - This file owns the metadata shape for daily task events.
 *  - If you later route this through ActivityMutation (which you should),
 *    only this file needs to change, not the mutations themselves.
 *
 * All functions are fire-and-forget (never throw to callers).
 * A failed activity log must never break a successful mutation.
 */

import { prisma } from '../../index.js';
import type { DailyTaskType } from './dailyTask.types.js';

export const DailyTaskActivity = {
  /**
   * Logs that a task was added to daily tasks.
   * Silently swallows errors — activity logging is non-critical.
   */
  async logAdded(params: {
    userId: string;
    taskId: string;
    taskTitle: string;
    workspaceId: string;
    type: DailyTaskType;
  }): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          action:      'UPDATED',
          entityType:  'TASK',
          entityId:    params.taskId,
          userId:      params.userId,
          workspaceId: params.workspaceId,
          taskId:      params.taskId,
          metadata: {
            taskTitle:      params.taskTitle,
            dailyTaskType:  params.type,
            action:         'added_to_daily_tasks',
          },
        },
      });
    } catch (error) {
      console.error('Failed to log daily task add activity:', error);
    }
  },

  /**
   * Logs that a task was removed from daily tasks.
   * Silently swallows errors — activity logging is non-critical.
   */
  async logRemoved(params: {
    userId: string;
    taskId: string;
    taskTitle: string;
    workspaceId: string;
    type: DailyTaskType;
  }): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          action:      'UPDATED',
          entityType:  'TASK',
          entityId:    params.taskId,
          userId:      params.userId,
          workspaceId: params.workspaceId,
          taskId:      params.taskId,
          metadata: {
            taskTitle:      params.taskTitle,
            dailyTaskType:  params.type,
            action:         'removed_from_daily_tasks',
          },
        },
      });
    } catch (error) {
      console.error('Failed to log daily task remove activity:', error);
    }
  },
};