import type { Response }  from 'express';
import { z }              from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { LabelQuery }    from './label.query.js';
import { LabelMutation } from './label.mutation.js';
import {
  LabelError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from './label.types.js';
import {
  createLabelSchema,
  updateLabelSchema,
  popularLabelsQuerySchema,
  labelsQuerySchema,
  labelTasksQuerySchema,
} from './label.validators.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireUserId(req: AuthRequest, res: Response): string | null {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return null;
  }
  return userId;
}

function handleError(error: unknown, res: Response): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors:  error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }
  if (error instanceof UnauthorizedError) {
    res.status(403).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof NotFoundError) {
    res.status(404).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof ConflictError) {
    res.status(409).json({ success: false, message: error.message });
    return;
  }
  if (error instanceof ValidationError || error instanceof LabelError) {
    res.status(400).json({ success: false, message: (error as Error).message });
    return;
  }
  console.error('Label controller error:', error);
  res.status(500).json({ success: false, message: 'An unexpected error occurred' });
}


export const getLabels = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { workspaceId, page, limit } = labelsQuerySchema.parse(req.query);

    const result = await LabelQuery.getLabels(userId, { workspaceId, page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(error, res);
  }
};

export const getPopularLabels = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { workspaceId, page, limit } = popularLabelsQuerySchema.parse(req.query);

    const result = await LabelQuery.getPopularLabels(userId, { workspaceId, page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(error, res);
  }
};

export const getLabelById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const label = await LabelQuery.getLabel(req.params.id, userId);
    res.json({ success: true, data: label });
  } catch (error) {
    handleError(error, res);
  }
};

export const getLabelTasks = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { page, limit, status, priority } = labelTasksQuerySchema.parse(req.query);

    const result = await LabelQuery.getLabelTasks(req.params.id, userId, {
      page,
      limit,
      status,
      priority,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    handleError(error, res);
  }
};

export const createLabel = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const data  = createLabelSchema.parse(req.body);
    const label = await LabelMutation.createLabel({ ...data, createdById: userId });
    res.status(201).json({ success: true, data: label, message: 'Label created successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

export const updateLabel = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const data  = updateLabelSchema.parse(req.body);
    const label = await LabelMutation.updateLabel(req.params.id, userId, data);
    res.json({ success: true, data: label, message: 'Label updated successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

export const deleteLabel = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const result = await LabelMutation.deleteLabel(req.params.id, userId);
    res.json({
      success: true,
      message: 'Label deleted successfully',
      data:    { tasksAffected: result.tasksAffected },
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const addLabelToTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { labelId, taskId } = req.params;
    const taskLabel = await LabelMutation.addLabelToTask(labelId, taskId, userId);
    res.status(201).json({ success: true, data: taskLabel, message: 'Label added to task successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

export const removeLabelFromTask = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { labelId, taskId } = req.params;
    await LabelMutation.removeLabelFromTask(labelId, taskId, userId);
    res.json({ success: true, message: 'Label removed from task successfully' });
  } catch (error) {
    handleError(error, res);
  }
};