/**
 * comment.controller.ts
 * Responsibility: HTTP layer for the Comment domain.
 *
 * Improvements:
 *  - Zod validation replaces manual if-checks
 *  - Task fetch centralized (was repeated 3 times in original)
 *  - Activity logging via callback pattern
 *  - Typed error handling
 */

import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { CommentQuery }    from './comment.query.js';
import { CommentMutation } from './comment.mutation.js';
import { CommentActivity } from './comment.activity.js';
import { prisma } from '../../index.js';
import { taskForActivitySelect } from './comment.selects.js';
import { createCommentSchema, updateCommentSchema } from './comment.validators.js';

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

/** GET / */
export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const comments = await CommentQuery.getComments(req.params.taskId, req.user!.id);
    res.json({ success: true, data: comments });
  } catch (error) {
    handleError(res, 'fetch comments', error);
  }
};

/** POST / */
export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const body = createCommentSchema.parse(req.body);

    const comment = await CommentMutation.createComment(
      { taskId, userId: req.user!.id, ...body },
      // onCreated callback — activity logging
      async ({ commentId, content }) => {
        const task = await prisma.task.findUnique({
          where:  { id: taskId },
          select: taskForActivitySelect,
        });

        if (task?.project?.workspaceId) {
          void CommentActivity.logCreated({
            commentId,
            taskId,
            taskTitle:      task.title,
            userId:         req.user!.id,
            workspaceId:    task.project.workspaceId,
            commentPreview: content!.substring(0, 100),
          });
        }
      },
    );

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    handleError(res, 'add comment', error);
  }
};

/** PUT /:commentId */
export const updateComment = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, commentId } = req.params;
    const body = updateCommentSchema.parse(req.body);

    const updated = await CommentMutation.updateComment(
      commentId, taskId, req.user!.id, body,
      // onUpdated callback
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

/** DELETE /:commentId */
export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, commentId } = req.params;

    await CommentMutation.deleteComment(
      commentId, taskId, req.user!.id,
      // onDeleted callback
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