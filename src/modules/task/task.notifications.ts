
import {
  notifyUser,
  notifyTaskAssignees,
  notifyMentions,
} from '../../utils/notification.helpers.js';
import { prisma } from '../../index.js';

export const TaskNotifications = {
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
        if (userId === params.creatorId) continue;

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