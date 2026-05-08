import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../../middleware/auth.js';
import { SubtaskQuery }    from './subtask.query.js';
import { SubtaskMutation } from './subtask.mutation.js';
import { SubtaskActivity } from './subtask.activity.js';
import { notifyUser }      from '../../notification/index.js';
import {
  createSubtaskSchema,
  updateSubtaskSchema,
  updateSubtaskStatusSchema,
} from './subtask.validators.js';

// ─── Error handler — matches task.controller handleError exactly ──────────────

function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    return;
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (msg.startsWith('NOT_FOUND:')) {
      res.status(404).json({ success: false, message: msg.replace('NOT_FOUND: ', '') });
    } else if (msg.startsWith('FORBIDDEN:')) {
      res.status(403).json({ success: false, message: msg.replace('FORBIDDEN: ', '') });
    } else if (msg.startsWith('BAD_REQUEST:')) {
      res.status(400).json({ success: false, message: msg.replace('BAD_REQUEST: ', '') });
    } else if (msg.includes('permission') || msg.includes('access')) {
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

// ─── Controllers ──────────────────────────────────────────────────────────────

export const getSubtasks = async (req: AuthRequest, res: Response) => {
  try {
    const subtasks = await SubtaskQuery.getSubtasks(
      req.params.taskId,
      req.user!.id,
    );
    res.json({ success: true, data: subtasks });
  } catch (error) {
    handleError(res, 'fetch subtasks', error);
  }
};

export const getSubtaskStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await SubtaskQuery.getSubtaskStats(
      req.params.taskId,
      req.user!.id,
    );
    res.json({ success: true, data: stats });
  } catch (error) {
    handleError(res, 'fetch subtask stats', error);
  }
};

export const getSubtask = async (req: AuthRequest, res: Response) => {
  try {
    const subtask = await SubtaskQuery.getSubtaskById(
      req.params.subtaskId,
      req.user!.id,
    );
    res.json({ success: true, data: subtask });
  } catch (error) {
    handleError(res, 'fetch subtask', error);
  }
};

export const createSubtask = async (req: AuthRequest, res: Response) => {
  try {
    const data = createSubtaskSchema.parse(req.body);

    const subtask = await SubtaskMutation.createSubtask(
      {
        ...data,
        parentId:    req.params.taskId,
        createdById: req.user!.id,
      },
      async ({ subtask, parentTaskId, workspaceId, assigneeIds }) => {
        // ── Activity log
        if (workspaceId) {
          void SubtaskActivity.logCreated({
            subtaskId:    subtask.id,
            subtaskTitle: subtask.title,
            parentTaskId,
            userId:       req.user!.id,
            workspaceId,
          });
        }

        // ── Notify assignees
        if (assigneeIds.length > 0) {
          const creatorName = req.user!.name ?? 'Someone';
          for (const userId of assigneeIds) {
            if (userId === req.user!.id) continue;
            void notifyUser({
              userId,
              senderId:  req.user!.id,
              type:      'TASK_ASSIGNED',
              title:     'Subtask Assigned',
              message:   `${creatorName} assigned you to "${subtask.title}"`,
              actionUrl: `/dashboard/tasks/${parentTaskId}`,
            });
          }
        }
      },
    );

    res.status(201).json({ success: true, message: 'Subtask created successfully', data: subtask });
  } catch (error) {
    handleError(res, 'create subtask', error);
  }
};

export const updateSubtask = async (req: AuthRequest, res: Response) => {
  try {
    const data = updateSubtaskSchema.parse(req.body);

    const subtask = await SubtaskMutation.updateSubtask(
      req.params.subtaskId,
      req.user!.id,
      data,
      async ({ subtask, parentTaskId, workspaceId, oldStatus, newStatus, changes }) => {
        if (!workspaceId) return;

        if (newStatus && oldStatus && newStatus !== oldStatus) {
          void SubtaskActivity.logStatusChanged({
            subtaskId:    subtask.id,
            subtaskTitle: subtask.title,
            parentTaskId,
            userId:       req.user!.id,
            workspaceId,
            oldStatus,
            newStatus,
          });
        } else {
          void SubtaskActivity.logUpdated({
            subtaskId:    subtask.id,
            subtaskTitle: subtask.title,
            parentTaskId,
            userId:       req.user!.id,
            workspaceId,
            changes,
          });
        }
      },
    );

    res.json({ success: true, message: 'Subtask updated successfully', data: subtask });
  } catch (error) {
    handleError(res, 'update subtask', error);
  }
};

export const updateSubtaskStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = updateSubtaskStatusSchema.parse(req.body);

    const subtask = await SubtaskMutation.updateSubtaskStatus(
      req.params.subtaskId,
      req.user!.id,
      status,
      async ({ subtask, parentTaskId, workspaceId, oldStatus, newStatus }) => {
        if (workspaceId && newStatus && oldStatus && newStatus !== oldStatus) {
          void SubtaskActivity.logStatusChanged({
            subtaskId:    subtask.id,
            subtaskTitle: subtask.title,
            parentTaskId,
            userId:       req.user!.id,
            workspaceId,
            oldStatus,
            newStatus,
          });
        }
      },
    );

    res.json({ success: true, data: subtask });
  } catch (error) {
    handleError(res, 'update subtask status', error);
  }
};

export const deleteSubtask = async (req: AuthRequest, res: Response) => {
  try {
    await SubtaskMutation.deleteSubtask(
      req.params.subtaskId,
      req.user!.id,
      async ({ subtask, parentTaskId, workspaceId }) => {
        if (workspaceId) {
          void SubtaskActivity.logDeleted({
            subtaskId:    subtask.id,
            subtaskTitle: subtask.title,
            parentTaskId,
            userId:       req.user!.id,
            workspaceId,
          });
        }
      },
    );

    res.json({ success: true, message: 'Subtask deleted successfully' });
  } catch (error) {
    handleError(res, 'delete subtask', error);
  }
};