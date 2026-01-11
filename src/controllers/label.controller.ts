
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../index.js';
import { z } from 'zod';

// Validation schemas
const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#([A-Fa-f0-9]{6})$/),
  description: z.string().optional(),
  workspaceId: z.string().optional(),
});

const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6})$/).optional(),
  description: z.string().optional().nullable(),
});

export const getLabels = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { workspaceId } = req.query;

    console.log('📋 Get labels - userId:', userId);
    console.log('📋 Get labels - workspaceId:', workspaceId);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // If workspaceId is provided, ONLY return labels from that workspace
    // Don't return personal labels when querying a specific workspace
    const labels = await prisma.label.findMany({
      where: workspaceId 
        ? {
            // Only labels from this specific workspace
            workspaceId: workspaceId as string,
          }
        : {
            // If no workspaceId, return only personal labels
            createdById: userId,
            workspaceId: null,
          },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    console.log('✅ Found labels:', labels.length);
    console.log('📤 Sending response:', labels);
    
    return res.json(labels);
  } catch (error) {
    console.error('❌ Error fetching labels:', error);
    return res.status(500).json({ message: 'Failed to fetch labels' });
  }
};

/**
 * @route   GET /api/labels/:id
 * @desc    Get single label by ID
 * @access  Private
 */
export const getLabelById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const label = await prisma.label.findUnique({
      where: { id },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        tasks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
              },
            },
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!label) {
      return res.status(404).json({ message: 'Label not found' });
    }

    // Check access
    if (label.workspaceId) {
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: label.workspaceId,
          userId,
        },
      });

      if (!member) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (label.createdById !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    return res.json(label);
  } catch (error) {
    console.error('Error fetching label:', error);
    return res.status(500).json({ message: 'Failed to fetch label' });
  }
};

/**
 * @route   POST /api/labels
 * @desc    Create a new label
 * @access  Private
 */
export const createLabel = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    console.log('📝 Create label - userId:', userId);
    console.log('📝 Create label - body:', req.body);

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const validation = createLabelSchema.safeParse(req.body);
    
    if (!validation.success) {
  const errorMessages = validation.error.issues.map(issue => issue.message).join(', ');
  console.log('❌ Validation failed:', validation.error.issues);
  return res.status(400).json({ 
    message: `Validation error: ${errorMessages}`,
    errors: validation.error.issues,
  });
}
    const { name, color, description, workspaceId } = validation.data;

    // Check if workspace exists and user has access
    if (workspaceId) {
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId,
          userId,
        },
      });

      if (!member) {
        return res.status(403).json({ message: 'Access denied to workspace' });
      }

      // Check for duplicate label name in workspace
      const existing = await prisma.label.findFirst({
        where: {
          workspaceId,
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (existing) {
        return res.status(409).json({ message: 'Label with this name already exists in workspace' });
      }
    }

    const label = await prisma.label.create({
      data: {
        name,
        color,
        description,
        workspaceId,
        createdById: userId,
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    console.log('✅ Label created:', label);
    console.log('📤 Sending response');
    
    // CRITICAL: Return the created label with 201 status
    return res.status(201).json(label);
  } catch (error) {
    console.error('❌ Error creating label:', error);
    return res.status(500).json({ message: 'Failed to create label' });
  }
};

/**
 * @route   PATCH /api/labels/:id
 * @desc    Update a label
 * @access  Private
 */
export const updateLabel = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const validation = updateLabelSchema.safeParse(req.body);
    
    if (!validation.success) {
  const errorMessages = validation.error.issues.map(issue => issue.message).join(', ');
  console.log('❌ Validation failed:', validation.error.issues);
  return res.status(400).json({ 
    message: `Validation error: ${errorMessages}`,
    errors: validation.error.issues,
  });
}

    // Check if label exists
    const existingLabel = await prisma.label.findUnique({
      where: { id },
      include: {
        workspace: true,
      },
    });

    if (!existingLabel) {
      return res.status(404).json({ message: 'Label not found' });
    }

    // Check access
   if (existingLabel.workspaceId) {
  // Check if user is the creator of the label
  const isCreator = existingLabel.createdById === userId;
  
  if (!isCreator) {
    // If not creator, check if they're workspace owner OR admin
    const workspace = await prisma.workspace.findUnique({
      where: { id: existingLabel.workspaceId },
      select: { ownerId: true },
    });

    const isWorkspaceOwner = workspace?.ownerId === userId;

    if (!isWorkspaceOwner) {
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: existingLabel.workspaceId,
          userId,
          role: 'ADMIN',
        },
      });

      if (!member) {
        return res.status(403).json({ 
          message: 'Only label creator, workspace owner or admins can edit labels' 
        });
      }
    }
  }
} else if (existingLabel.createdById !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, color, description } = validation.data;

    // Check for duplicate name if updating name
    if (name && name !== existingLabel.name) {
      const duplicate = await prisma.label.findFirst({
        where: {
          workspaceId: existingLabel.workspaceId,
          name: {
            equals: name,
            mode: 'insensitive',
          },
          id: {
            not: id,
          },
        },
      });

      if (duplicate) {
        return res.status(409).json({ message: 'Label with this name already exists' });
      }
    }

    const label = await prisma.label.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color && { color }),
        ...(description !== undefined && { description }),
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    console.log('✅ Label updated:', label);
    return res.json(label);
  } catch (error) {
    console.error('Error updating label:', error);
    return res.status(500).json({ message: 'Failed to update label' });
  }
};

export const deleteLabel = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if label exists
    const label = await prisma.label.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    if (!label) {
      return res.status(404).json({ message: 'Label not found' });
    }

    // Check access
    if (label.workspaceId) {
  // Check if user is the creator of the label
  const isCreator = label.createdById === userId;
  
  if (!isCreator) {
    // If not creator, check if they're workspace owner OR admin
    const workspace = await prisma.workspace.findUnique({
      where: { id: label.workspaceId },
      select: { ownerId: true },
    });

    const isWorkspaceOwner = workspace?.ownerId === userId;

    if (!isWorkspaceOwner) {
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: label.workspaceId,
          userId,
          role: 'ADMIN',
        },
      });

      if (!member) {
        return res.status(403).json({ 
          message: 'Only label creator, workspace owner or admins can edit labels' 
        });
      }
    }
  }
} else if (label.createdById !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete the label (cascade will remove TaskLabel relations)
    await prisma.label.delete({
      where: { id },
    });

    return res.json({ 
      message: 'Label deleted successfully',
      tasksAffected: label._count.tasks,
    });
  } catch (error) {
    console.error('Error deleting label:', error);
    return res.status(500).json({ message: 'Failed to delete label' });
  }
};

export const addLabelToTask = async (req: AuthRequest, res: Response) => {
  try {
    const { labelId, taskId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if task exists and user has access
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        workspace: true,
      },
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if label exists
    const label = await prisma.label.findUnique({
      where: { id: labelId },
    });

    if (!label) {
      return res.status(404).json({ message: 'Label not found' });
    }

    // Check if label already added
    const existing = await prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ message: 'Label already added to task' });
    }

    // Add label to task
    const taskLabel = await prisma.taskLabel.create({
      data: {
        taskId,
        labelId,
      },
      include: {
        label: true,
      },
    });

    return res.status(201).json(taskLabel);
  } catch (error) {
    console.error('Error adding label to task:', error);
    return res.status(500).json({ message: 'Failed to add label to task' });
  }
};

/**
 * @route   DELETE /api/labels/:labelId/tasks/:taskId
 * @desc    Remove label from task
 * @access  Private
 */
export const removeLabelFromTask = async (req: AuthRequest, res: Response) => {
  try {
    const { labelId, taskId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Check if task label exists
    const taskLabel = await prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });

    if (!taskLabel) {
      return res.status(404).json({ message: 'Label not found on task' });
    }

    // Remove label from task
    await prisma.taskLabel.delete({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });

    return res.json({ message: 'Label removed from task' });
  } catch (error) {
    console.error('Error removing label from task:', error);
    return res.status(500).json({ message: 'Failed to remove label from task' });
  }
};

/**
 * @route   GET /api/labels/popular
 * @desc    Get most used labels
 * @access  Private
 */
export const getPopularLabels = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { workspaceId, limit = '10' } = req.query;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const whereConditions: any[] = [
      { createdById: userId },
    ];

    if (workspaceId) {
      whereConditions.push({ workspaceId: workspaceId as string });
    }

    const labels = await prisma.label.findMany({
      where: {
        OR: whereConditions,
      },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
      },
      orderBy: {
        tasks: {
          _count: 'desc',
        },
      },
      take: parseInt(limit as string),
    });

    return res.json(labels);
  } catch (error) {
    console.error('Error fetching popular labels:', error);
    return res.status(500).json({ message: 'Failed to fetch popular labels' });
  }
};
