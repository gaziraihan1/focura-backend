
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { CommentQuery }    from './comment.query.js';
import { CommentMutation } from './comment.mutation.js';
import { CommentActivity } from './comment.activity.js';
import { prisma } from '../../index.js';
import { taskForActivitySelect } from './comment.selects.js';
import { createCommentSchema, updateCommentSchema } from './comment.validators.js';
import { notifyMentions, notifyTaskAssignees, notifyUser } from '../notification/index.js';
import { stripMentionSyntax } from './mention/mention.utils.js';
import { NotificationMutation } from '../notification/notification.mutation.js';

function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    return;
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (msg === 'Comment not found' || msg === 'Task not found or access denied') {
      res.status(404).json({ success: false, message: msg });
    } else if (msg.includes('cannot modify') || msg.includes('access denied')) {
      res.status(403).json({ success: false, message: msg });
    } else {
      console.error(`${label} error:`, error);
      res.status(500).json({ success: false, message: `Failed to ${label}` });
    }
    return;
  }

  console.error(`${label} error:`, error);
  res.status(500).json({ success: false, message: `Failed to ${label}` });
}

export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const comments = await CommentQuery.getComments(req.params.taskId, req.user!.id);
    res.json({ success: true, data: comments });
  } catch (error) {
    handleError(res, 'fetch comments', error);
  }
};


export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const body = createCommentSchema.parse(req.body);

    const comment = await CommentMutation.createComment(
      { taskId, userId: req.user!.id, ...body },
      async ({ commentId, content, parentId }) => {
        const task = await prisma.task.findUnique({
          where:  { id: taskId },
          select: taskForActivitySelect,
        });

        if (!task?.project?.workspaceId) return;
        const workspaceId = task.project.workspaceId;
        const plainContent = stripMentionSyntax(content!);
        const senderName   = req.user!.name ?? 'Someone';
        const actionUrl    = `/dashboard/tasks/${taskId}`;

        // ── Activity log
        void CommentActivity.logCreated({
          commentId,
          taskId,
          taskTitle:      task.title,
          userId:         req.user!.id,
          workspaceId,
          commentPreview: plainContent.substring(0, 100),
        });

        // ── Notify task creator (skip if they are the commenter)
        if (
          task.createdById !== req.user!.id &&
          task.createdBy?.notifications
        ) {
          void notifyUser({
            userId:   task.createdById,
            senderId: req.user!.id,
            type:     'TASK_COMMENTED',
            title:    'New comment on your task',
            message:  `${senderName} commented on "${task.title}"`,
            actionUrl,
          });
        }

        // ── Notify assignees — skip commenter AND creator (already notified above)
        const assigneesToNotify = (task.assignees ?? []).filter(
          (a) =>
            a.userId !== req.user!.id &&
            a.userId !== task.createdById &&
            a.user?.notifications
        );

        void Promise.allSettled(
          assigneesToNotify.map((a) =>
            notifyUser({
              userId:   a.userId,
              senderId: req.user!.id,
              type:     'TASK_COMMENTED',
              title:    'New comment on a task',
              message:  `${senderName} commented on "${task.title}"`,
              actionUrl,
            })
          )
        );

        // ── Mention notifications
        if (content) {
          void notifyMentions({
            text:       content,
            workspaceId,
            senderId:   req.user!.id,
            senderName,
            context:    `a comment on "${task.title}"`,
            actionUrl,
          });
        }

        // ── Reply notification — notify parent comment author
        // Skip if they are the commenter, already notified as creator,
        // or already notified as assignee
        if (parentId) {
          const parent = await prisma.comment.findUnique({
            where:  { id: parentId },
            select: { userId: true, user: { select: { notifications: true } } },
          });

          const alreadyNotified = new Set([
            req.user!.id,
            task.createdById,
            ...assigneesToNotify.map((a) => a.userId),
          ]);

          if (
            parent &&
            !alreadyNotified.has(parent.userId) &&
            parent.user.notifications
          ) {
            void notifyUser({
              userId:   parent.userId,
              senderId: req.user!.id,
              type:     'TASK_COMMENTED',
              title:    'New reply on your comment',
              message:  `${senderName} replied to your comment on "${task.title}"`,
              actionUrl,
            });
          }
        }
      },
    );

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    handleError(res, 'add comment', error);
  }
};

export const updateComment = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, commentId } = req.params;
    const body = updateCommentSchema.parse(req.body);

    const updated = await CommentMutation.updateComment(
      commentId, taskId, req.user!.id, body,
      async ({ oldContent, newContent }) => {
        const task = await prisma.task.findUnique({
          where:  { id: taskId },
          select: taskForActivitySelect,
        });

        if (task?.project?.workspaceId) {
          void CommentActivity.logUpdated({
            commentId,
            taskId,
            taskTitle:   task.title,
            userId:      req.user!.id,
            workspaceId: task.project.workspaceId,
            oldContent:  oldContent!.substring(0, 50),
            newContent:  newContent!.substring(0, 50),
          });
        }
      },
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    handleError(res, 'update comment', error);
  }
};

export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, commentId } = req.params;

    await CommentMutation.deleteComment(
      commentId, taskId, req.user!.id,
      async ({ content }) => {
        const task = await prisma.task.findUnique({
          where:  { id: taskId },
          select: taskForActivitySelect,
        });

        if (task?.project?.workspaceId) {
          void CommentActivity.logDeleted({
            commentId,
            taskId,
            taskTitle:      task.title,
            userId:         req.user!.id,
            workspaceId:    task.project.workspaceId,
            commentContent: content!.substring(0, 100),
          });
        }
      },
    );

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    handleError(res, 'delete comment', error);
  }
};