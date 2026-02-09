import { prisma } from "../index.js";


export interface CreateLabelDto {
  name: string;
  color: string;
  description?: string;
  workspaceId?: string;
  createdById: string;
}

export interface UpdateLabelDto {
  name?: string;
  color?: string;
  description?: string | null;
}

export interface LabelFilters {
  workspaceId?: string;
}

export interface PopularLabelsFilters {
  workspaceId?: string;
  limit?: number;
}


export class LabelError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'LabelError';
  }
}

export class UnauthorizedError extends LabelError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED');
  }
}

export class NotFoundError extends LabelError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND');
  }
}

export class ValidationError extends LabelError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends LabelError {
  constructor(message: string) {
    super(message, 'CONFLICT');
  }
}


const getLabelInclude = () => ({
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
});

const checkLabelAccess = async (labelId: string, userId: string) => {
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    include: {
      workspace: true,
    },
  });

  if (!label) {
    throw new NotFoundError('Label not found');
  }

  if (label.workspaceId) {
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: label.workspaceId,
        userId,
      },
    });

    if (!member) {
      throw new UnauthorizedError('Access denied');
    }
  } 
  else if (label.createdById !== userId) {
    throw new UnauthorizedError('Access denied');
  }

  return label;
};

const checkLabelEditPermission = async (label: any, userId: string): Promise<boolean> => {
  if (label.createdById === userId) {
    return true;
  }

  if (label.workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: label.workspaceId },
      select: { ownerId: true },
    });

    if (workspace?.ownerId === userId) {
      return true;
    }

    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: label.workspaceId,
        userId,
        role: 'ADMIN',
      },
    });

    return !!member;
  }

  return false;
};

const checkDuplicateLabelName = async (
  name: string,
  workspaceId: string | null | undefined,
  createdById: string,
  excludeLabelId?: string
) => {
  const where: any = {
    name: {
      equals: name,
      mode: 'insensitive',
    },
  };

  if (workspaceId) {
    where.workspaceId = workspaceId;
  } else {
    where.workspaceId = null;
    where.createdById = createdById;
  }

  if (excludeLabelId) {
    where.id = { not: excludeLabelId };
  }

  const existing = await prisma.label.findFirst({ where });

  if (existing) {
    const scope = workspaceId ? 'workspace' : 'your personal labels';
    throw new ConflictError(`Label with this name already exists in ${scope}`);
  }
};

const checkTaskAccess = async (taskId: string, userId: string) => {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [
        { createdById: userId },
        { assignees: { some: { userId } } },
        {
          project: {
            workspace: {
              OR: [
                { ownerId: userId },
                { members: { some: { userId } } },
              ],
            },
          },
        },
      ],
    },
  });

  if (!task) {
    throw new NotFoundError('Task not found or access denied');
  }

  return task;
};


export const LabelService = {
  async getLabels(userId: string, filters: LabelFilters = {}) {
    let where: any = {};

    if (filters.workspaceId) {
      where = {
        workspaceId: filters.workspaceId,
      };
    } else {
      where = {
        createdById: userId,
        workspaceId: null,
      };
    }

    const labels = await prisma.label.findMany({
      where,
      include: getLabelInclude(),
      orderBy: {
        name: 'asc',
      },
    });

    return labels;
  },

  async getLabel(labelId: string, userId: string) {
    await checkLabelAccess(labelId, userId);

    const label = await prisma.label.findUnique({
      where: { id: labelId },
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
      throw new NotFoundError('Label not found');
    }

    return label;
  },

  async getPopularLabels(userId: string, filters: PopularLabelsFilters = {}) {
    const limit = filters.limit || 10;
    let where: any = {};

    if (filters.workspaceId) {
      where = {
        workspaceId: filters.workspaceId,
      };
    } else {
      where = {
        OR: [
          { createdById: userId, workspaceId: null },
          {
            workspace: {
              OR: [
                { ownerId: userId },
                { members: { some: { userId } } },
              ],
            },
          },
        ],
      };
    }

    const labels = await prisma.label.findMany({
      where,
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
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
      },
      orderBy: {
        tasks: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return labels;
  },

  async createLabel(data: CreateLabelDto) {
    if (data.workspaceId) {
      const member = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: data.workspaceId,
          userId: data.createdById,
        },
      });

      if (!member) {
        throw new UnauthorizedError('Access denied to workspace');
      }
    }

    await checkDuplicateLabelName(data.name, data.workspaceId, data.createdById);

    const label = await prisma.label.create({
      data: {
        name: data.name,
        color: data.color,
        description: data.description,
        workspaceId: data.workspaceId,
        createdById: data.createdById,
      },
      include: getLabelInclude(),
    });

    return label;
  },

  async updateLabel(labelId: string, userId: string, data: UpdateLabelDto) {
    const existingLabel = await prisma.label.findUnique({
      where: { id: labelId },
      include: {
        workspace: true,
      },
    });

    if (!existingLabel) {
      throw new NotFoundError('Label not found');
    }

    const canEdit = await checkLabelEditPermission(existingLabel, userId);
    if (!canEdit) {
      throw new UnauthorizedError('Only label creator, workspace owner or admins can edit labels');
    }

    if (data.name && data.name !== existingLabel.name) {
      await checkDuplicateLabelName(
        data.name,
        existingLabel.workspaceId,
        existingLabel.createdById,
        labelId
      );
    }

    const label = await prisma.label.update({
      where: { id: labelId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.color && { color: data.color }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: getLabelInclude(),
    });

    return label;
  },

  async deleteLabel(labelId: string, userId: string) {
    const label = await prisma.label.findUnique({
      where: { id: labelId },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
        workspace: true,
      },
    });

    if (!label) {
      throw new NotFoundError('Label not found');
    }

    const canEdit = await checkLabelEditPermission(label, userId);
    if (!canEdit) {
      throw new UnauthorizedError('Only label creator, workspace owner or admins can delete labels');
    }

    await prisma.label.delete({
      where: { id: labelId },
    });

    return {
      tasksAffected: label._count.tasks,
    };
  },

  async addLabelToTask(labelId: string, taskId: string, userId: string) {
    await checkTaskAccess(taskId, userId);

    const label = await prisma.label.findUnique({
      where: { id: labelId },
    });

    if (!label) {
      throw new NotFoundError('Label not found');
    }

    const existing = await prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });

    if (existing) {
      throw new ConflictError('Label already added to task');
    }

    const taskLabel = await prisma.taskLabel.create({
      data: {
        taskId,
        labelId,
      },
      include: {
        label: {
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
        },
      },
    });

    return taskLabel;
  },

  async removeLabelFromTask(labelId: string, taskId: string, userId: string) {
    await checkTaskAccess(taskId, userId);

    const taskLabel = await prisma.taskLabel.findUnique({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });

    if (!taskLabel) {
      throw new NotFoundError('Label not found on task');
    }

    await prisma.taskLabel.delete({
      where: {
        taskId_labelId: {
          taskId,
          labelId,
        },
      },
    });
  },
};