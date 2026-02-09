import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import {
  LabelService,
  LabelError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../services/label.service.js';


const createLabelSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be less than 50 characters'),
  color: z.string().regex(/^#([A-Fa-f0-9]{6})$/, 'Invalid color format (must be #RRGGBB)'),
  description: z.string().optional(),
  workspaceId: z.string().optional(),
});

const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6})$/).optional(),
  description: z.string().optional().nullable(),
});

const popularLabelsQuerySchema = z.object({
  workspaceId: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});


const handleError = (error: unknown, res: Response) => {
  console.error('Label controller error:', error);

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  if (error instanceof UnauthorizedError) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof ConflictError) {
    return res.status(409).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof LabelError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
  });
};


export const getLabels = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const { workspaceId } = req.query;

    const labels = await LabelService.getLabels(userId, {
      workspaceId: workspaceId as string | undefined,
    });

    res.json({
      success: true,
      data: labels,
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const getLabelById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const label = await LabelService.getLabel(id, userId);

    res.json({
      success: true,
      data: label,
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const getPopularLabels = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const validatedQuery = popularLabelsQuerySchema.parse(req.query);

    const labels = await LabelService.getPopularLabels(userId, {
      workspaceId: validatedQuery.workspaceId,
      limit: validatedQuery.limit || 10,
    });

    res.json({
      success: true,
      data: labels,
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const createLabel = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const validatedData = createLabelSchema.parse(req.body);

    const label = await LabelService.createLabel({
      ...validatedData,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      data: label,
      message: 'Label created successfully',
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const updateLabel = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const validatedData = updateLabelSchema.parse(req.body);

    const label = await LabelService.updateLabel(id, userId, validatedData);

    res.json({
      success: true,
      data: label,
      message: 'Label updated successfully',
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const deleteLabel = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const result = await LabelService.deleteLabel(id, userId);

    res.json({
      success: true,
      message: 'Label deleted successfully',
      data: {
        tasksAffected: result.tasksAffected,
      },
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const addLabelToTask = async (req: AuthRequest, res: Response) => {
  try {
    const { labelId, taskId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const taskLabel = await LabelService.addLabelToTask(labelId, taskId, userId);

    res.status(201).json({
      success: true,
      data: taskLabel,
      message: 'Label added to task successfully',
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const removeLabelFromTask = async (req: AuthRequest, res: Response) => {
  try {
    const { labelId, taskId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    await LabelService.removeLabelFromTask(labelId, taskId, userId);

    res.json({
      success: true,
      message: 'Label removed from task successfully',
    });
  } catch (error) {
    handleError(error, res);
  }
};