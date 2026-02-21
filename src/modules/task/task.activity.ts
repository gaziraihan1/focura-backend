/**
 * task.activity.ts
 * Responsibility: Activity log entries specific to Task mutations.
 *
 * The original had `prisma.activity.create()` calls embedded directly
 * inside createTask, updateTask, updateTaskStatus, and deleteTask.
 * All extracted here — never throws to the caller.
 *
 * All functions are fire-and-forget (void promises).
 * A failed activity log must never break a successful mutation.
 */

import { prisma } from '../../index.js';

export const TaskActivity = {
  /**
   * Logs that a task was created.
   */
  async logCreated(params: {
    taskId:        string;
    taskTitle:     string;
    userId:        string;
    workspaceId:   string;
    focusRequired?: boolean;
    energyType?:   string | null;
    intent?:       string | null;
  }): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          action:      'CREATED',
          entityType:  'TASK',
          entityId:    params.taskId,
          userId:      params.userId,
          workspaceId: params.workspaceId,
          taskId:      params.taskId,
          metadata: {
            taskTitle:     params.taskTitle,
            focusRequired: params.focusRequired,
            energyType:    params.energyType,
            intent:        params.intent,
          },
        },
      });
    } catch (error) {
      console.error('Failed to log task creation activity:', error);
    }
  },

  /**
   * Logs that a task's status was changed.
   */
  async logStatusChanged(params: {
    taskId:      string;
    taskTitle:   string;
    userId:      string;
    workspaceId: string;
    oldStatus:   string;
    newStatus:   string;
  }): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          action:      'STATUS_CHANGED',
          entityType:  'TASK',
          entityId:    params.taskId,
          userId:      params.userId,
          workspaceId: params.workspaceId,
          taskId:      params.taskId,
          metadata: {
            taskTitle: params.taskTitle,
            oldStatus: params.oldStatus,
            newStatus: params.newStatus,
          },
        },
      });
    } catch (error) {
      console.error('Failed to log status change activity:', error);
    }
  },

  /**
   * Logs that a task was updated (generic update — not status-specific).
   */
  async logUpdated(params: {
    taskId:      string;
    taskTitle:   string;
    userId:      string;
    workspaceId: string;
    changes:     Record<string, any>;
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
            taskTitle: params.taskTitle,
            changes:   params.changes,
          },
        },
      });
    } catch (error) {
      console.error('Failed to log task update activity:', error);
    }
  },

  /**
   * Logs that a task was deleted.
   */
  async logDeleted(params: {
    taskId:      string;
    taskTitle:   string;
    userId:      string;
    workspaceId: string;
    status:      string;
    priority:    string;
  }): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          action:      'DELETED',
          entityType:  'TASK',
          entityId:    params.taskId,
          userId:      params.userId,
          workspaceId: params.workspaceId,
          metadata: {
            taskTitle: params.taskTitle,
            status:    params.status,
            priority:  params.priority,
            deletedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      console.error('Failed to log task deletion activity:', error);
    }
  },
};