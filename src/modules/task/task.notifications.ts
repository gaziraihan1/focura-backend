/**
 * task.notifications.ts
 * Responsibility: Notification callbacks for Task mutations.
 *
 * The original had direct calls to `notifyUser`, `notifyTaskAssignees`,
 * and `notifyMentions` embedded inside createTask, updateTask, etc.
 *
 * Extracted here using the callback pattern (same as focusSession module).
 * The mutation accepts an optional callback, the controller provides it.
 * Task module never imports from notification helpers directly.
 *
 * All functions are fire-and-forget (void promises).
 */

import {
  notifyUser,
  notifyTaskAssignees,
  notifyMentions,
} from '../../utils/notification.helpers.js';
import { prisma } from '../../index.js';

export const TaskNotifications = {
  /**
   * Notifies newly assigned users when a task is created.
   */
  async notifyNewAssignees(params: {
    taskId:       string;
    taskTitle:    string;
    assigneeIds:  string[];
    creatorId:    string;
  }): Promise<void> {
    try {
      if (params.assigneeIds.length === 0) return;

      const creator = await prisma.user.findUnique({
        where:  { id: params.creatorId },
        select: { name: true },
      });

      for (const userId of params.assigneeIds) {
        if (userId === params.creatorId) continue; // Don't notify creator

        notifyUser({
          userId,
          senderId: params.creatorId,
          type:     'TASK_ASSIGNED',
          title:    'New Task Assigned',
          message:  `${creator?.name || 'Someone'} assigned you a task`,
          actionUrl: `/dashboard/tasks/${params.taskId}`,
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to notify new assignees:', error);
    }
  },

  /**
   * Notifies newly added assignees when a task is updated.
   * Only notifies users who weren't already assigned.
   */
  async notifyAddedAssignees(params: {
    taskId:        string;
    taskTitle:     string;
    addedIds:      string[];
    updaterId:     string;
  }): Promise<void> {
    try {
      if (params.addedIds.length === 0) return;

      const updater = await prisma.user.findUnique({
        where:  { id: params.updaterId },
        select: { name: true },
      });

      for (const userId of params.addedIds) {
        if (userId === params.updaterId) continue;

        notifyUser({
          userId,
          senderId:  params.updaterId,
          type:      'TASK_ASSIGNED',
          title:     'Task Assigned',
          message:   `${updater?.name || 'Someone'} assigned you to "${params.taskTitle}"`,
          actionUrl: `/dashboard/tasks/${params.taskId}`,
        }).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to notify added assignees:', error);
    }
  },

  /**
   * Notifies all assignees when a task is completed.
   */
  async notifyTaskCompleted(params: {
    taskId:    string;
    taskTitle: string;
    userId:    string;
  }): Promise<void> {
    try {
      notifyTaskAssignees({
        taskId:        params.taskId,
        senderId:      params.userId,
        type:          'TASK_COMPLETED',
        title:         'Task Completed',
        message:       `Task "${params.taskTitle}" was completed`,
        excludeUserId: params.userId,
      }).catch(() => {});
    } catch (error) {
      console.error('Failed to notify task completion:', error);
    }
  },

  /**
   * Notifies task assignees when a comment is added.
   */
  async notifyNewComment(params: {
    taskId:       string;
    taskTitle:    string;
    commenterId:  string;
    commenterName: string;
  }): Promise<void> {
    try {
      notifyTaskAssignees({
        taskId:        params.taskId,
        senderId:      params.commenterId,
        type:          'TASK_COMMENTED',
        title:         'New Comment',
        message:       `${params.commenterName} commented on "${params.taskTitle}"`,
        excludeUserId: params.commenterId,
      }).catch(() => {});
    } catch (error) {
      console.error('Failed to notify new comment:', error);
    }
  },

  /**
   * Notifies mentioned users in a comment.
   */
  async notifyCommentMentions(params: {
    taskId:        string;
    taskTitle:     string;
    commentText:   string;
    workspaceId:   string;
    senderId:      string;
    senderName:    string;
  }): Promise<void> {
    try {
      notifyMentions({
        text:        params.commentText,
        workspaceId: params.workspaceId,
        senderId:    params.senderId,
        senderName:  params.senderName,
        context:     `task "${params.taskTitle}"`,
        actionUrl:   `/dashboard/tasks/${params.taskId}`,
      }).catch(() => {});
    } catch (error) {
      console.error('Failed to notify comment mentions:', error);
    }
  },
};