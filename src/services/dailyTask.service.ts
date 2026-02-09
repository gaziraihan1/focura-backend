import { prisma } from '../index.js';

export class DailyTaskService {
  static async getDailyTasks(params: {
    userId: string;
    date: Date;
  }) {
    const startOfDay = new Date(params.date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(params.date);
    endOfDay.setHours(23, 59, 59, 999);

    const dailyTasks = await prisma.dailyTask.findMany({
      where: {
        userId: params.userId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        task: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, image: true },
            },
            assignees: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, image: true },
                },
              },
            },
            labels: {
              include: { label: true },
            },
            project: {
              select: { 
                id: true, 
                name: true, 
                color: true,
                workspace: {
                  select: { id: true, name: true }
                }
              },
            },
            _count: {
              select: {
                comments: true,
                subtasks: true,
                files: true,
              },
            },
          },
        },
      },
      orderBy: [
        { type: 'asc' }, // PRIMARY first, then SECONDARY
        { addedAt: 'asc' },
      ],
    });

    const primaryTask = dailyTasks.find(dt => dt.type === 'PRIMARY');
    const secondaryTasks = dailyTasks.filter(dt => dt.type === 'SECONDARY');

    return {
      primaryTask: primaryTask || null,
      secondaryTasks: secondaryTasks || [],
    };
  }

  static async addDailyTask(params: {
    userId: string;
    taskId: string;
    type: 'PRIMARY' | 'SECONDARY';
    date?: Date;
  }) {
    const date = params.date || new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const task = await prisma.task.findFirst({
      where: {
        id: params.taskId,
        OR: [
          { createdById: params.userId },
          { assignees: { some: { userId: params.userId } } },
          {
            project: {
              workspace: {
                members: { some: { userId: params.userId } },
              },
            },
          },
        ],
      },
      include: {
        project: {
          select: {
            workspace: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found or you do not have access to this task');
    }

    if (task.status === 'COMPLETED') {
      throw new Error('Cannot add a completed task to daily tasks');
    }

    if (params.type === 'PRIMARY') {
      const existingPrimary = await prisma.dailyTask.findFirst({
        where: {
          userId: params.userId,
          type: 'PRIMARY',
          date: {
            gte: startOfDay,
            lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existingPrimary) {
        throw new Error('You already have a primary task for today. Remove it first or choose secondary.');
      }
    }

    const existing = await prisma.dailyTask.findFirst({
      where: {
        userId: params.userId,
        taskId: params.taskId,
        date: {
          gte: startOfDay,
          lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existing) {
      if (existing.type === params.type) {
        return existing;
      }
      
      return await prisma.dailyTask.update({
        where: { id: existing.id },
        data: { type: params.type },
        include: {
          task: {
            include: {
              createdBy: {
                select: { id: true, name: true, email: true, image: true },
              },
              assignees: {
                include: {
                  user: {
                    select: { id: true, name: true, email: true, image: true },
                  },
                },
              },
              labels: {
                include: { label: true },
              },
              project: {
                select: { 
                  id: true, 
                  name: true, 
                  color: true,
                  workspace: {
                    select: { id: true, name: true }
                  }
                },
              },
            },
          },
        },
      });
    }

    const dailyTask = await prisma.dailyTask.create({
      data: {
        userId: params.userId,
        taskId: params.taskId,
        type: params.type,
        date: startOfDay,
      },
      include: {
        task: {
          include: {
            createdBy: {
              select: { id: true, name: true, email: true, image: true },
            },
            assignees: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, image: true },
                },
              },
            },
            labels: {
              include: { label: true },
            },
            project: {
              select: { 
                id: true, 
                name: true, 
                color: true,
                workspace: {
                  select: { id: true, name: true }
                }
              },
            },
          },
        },
      },
    });

    if (task.project?.workspace?.id) {
      try {
        await prisma.activity.create({
          data: {
            action: 'UPDATED',
            entityType: 'TASK',
            entityId: params.taskId,
            userId: params.userId,
            workspaceId: task.project.workspace.id,
            taskId: params.taskId,
            metadata: {
              taskTitle: task.title,
              dailyTaskType: params.type,
              action: 'added_to_daily_tasks',
            },
          },
        });
      } catch (error) {
        console.error('Failed to log daily task activity:', error);
      }
    }

    return dailyTask;
  }

  static async removeDailyTask(params: {
    userId: string;
    taskId: string;
    date?: Date;
  }) {
    const date = params.date || new Date();
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const dailyTask = await prisma.dailyTask.findFirst({
      where: {
        userId: params.userId,
        taskId: params.taskId,
        date: {
          gte: startOfDay,
          lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      include: {
        task: {
          include: {
            project: {
              select: {
                workspace: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!dailyTask) {
      throw new Error('Daily task not found');
    }

    await prisma.dailyTask.delete({
      where: { id: dailyTask.id },
    });

    if (dailyTask.task.project?.workspace?.id) {
      try {
        await prisma.activity.create({
          data: {
            action: 'UPDATED',
            entityType: 'TASK',
            entityId: params.taskId,
            userId: params.userId,
            workspaceId: dailyTask.task.project.workspace.id,
            taskId: params.taskId,
            metadata: {
              taskTitle: dailyTask.task.title,
              dailyTaskType: dailyTask.type,
              action: 'removed_from_daily_tasks',
            },
          },
        });
      } catch (error) {
        console.error('Failed to log daily task removal activity:', error);
      }
    }

    return { success: true, message: 'Daily task removed successfully' };
  }

  static async clearExpiredDailyTasks() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await prisma.dailyTask.deleteMany({
      where: {
        date: {
          lt: today,
        },
      },
    });

    return {
      success: true,
      deletedCount: result.count,
      message: `Cleared ${result.count} expired daily tasks`,
    };
  }

  static async getDailyTaskStats(params: {
    userId: string;
    startDate: Date;
    endDate: Date;
  }) {
    const dailyTasks = await prisma.dailyTask.findMany({
      where: {
        userId: params.userId,
        date: {
          gte: params.startDate,
          lte: params.endDate,
        },
      },
      include: {
        task: {
          select: {
            id: true,
            status: true,
            completedAt: true,
          },
        },
      },
    });

    const primaryTasks = dailyTasks.filter(dt => dt.type === 'PRIMARY');
    const secondaryTasks = dailyTasks.filter(dt => dt.type === 'SECONDARY');

    const completedPrimaryTasks = primaryTasks.filter(
      dt => dt.task.status === 'COMPLETED'
    );
    const completedSecondaryTasks = secondaryTasks.filter(
      dt => dt.task.status === 'COMPLETED'
    );

    return {
      totalDays: Math.ceil(
        (params.endDate.getTime() - params.startDate.getTime()) / (1000 * 60 * 60 * 24)
      ),
      primaryTasksSet: primaryTasks.length,
      secondaryTasksSet: secondaryTasks.length,
      primaryTasksCompleted: completedPrimaryTasks.length,
      secondaryTasksCompleted: completedSecondaryTasks.length,
      primaryCompletionRate: primaryTasks.length > 0
        ? (completedPrimaryTasks.length / primaryTasks.length) * 100
        : 0,
      secondaryCompletionRate: secondaryTasks.length > 0
        ? (completedSecondaryTasks.length / secondaryTasks.length) * 100
        : 0,
    };
  }
}