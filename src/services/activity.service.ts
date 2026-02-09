import { prisma } from "../index.js";

type ActivityType = 
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'COMPLETED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'COMMENTED'
  | 'UPLOADED'
  | 'MOVED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED';

type EntityType = 
  | 'TASK'
  | 'PROJECT'
  | 'COMMENT'
  | 'FILE'
  | 'WORKSPACE'
  | 'MEMBER';

export interface ActivityFilters {
  workspaceId?: string;
  entityType?: EntityType;
  action?: ActivityType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface CreateActivityParams {
  action: ActivityType;
  entityType: EntityType;
  entityId: string;
  userId: string;
  workspaceId: string; // Required in your schema
  taskId?: string;
  metadata?: any;
}

export const ActivityService = {
  /**
   * Create a new activity log
   */
  async createActivity(params: CreateActivityParams) {
    const activity = await prisma.activity.create({
      data: {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: params.userId,
        workspaceId: params.workspaceId, // Required in schema
        taskId: params.taskId,
        metadata: params.metadata || {},
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            project: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
    });

    return activity;
  },

  async getUserActivities(userId: string, filters: ActivityFilters = {}) {
    const where: any = {
      OR: [
        { userId },
        {
          workspace: {
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } },
            ],
          },
        },
        {
          task: {
            assignees: { some: { userId } },
          },
        },
        {
          task: {
            createdById: userId,
          },
        },
      ],
    };

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            project: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });

    return activities;
  },

  async getWorkspaceActivities(
    workspaceId: string,
    filters: Pick<ActivityFilters, 'action' | 'entityType' | 'limit' | 'offset'> = {}
  ) {
    const where: any = { workspaceId };

    if (filters.action) {
      where.action = filters.action;
    }

    if (filters.entityType) {
      where.entityType = filters.entityType;
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            project: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });

    return activities;
  },

  async getTaskActivities(
    taskId: string,
    filters: Pick<ActivityFilters, 'limit' | 'offset'> = {}
  ) {
    const activities = await prisma.activity.findMany({
      where: { taskId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });

    return activities;
  },

  async deleteActivity(activityId: string, userId: string) {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    if (activity.userId !== userId) {
      if (activity.workspaceId) {
        const workspace = await prisma.workspace.findFirst({
          where: {
            id: activity.workspaceId,
            OR: [
              { ownerId: userId },
              {
                members: {
                  some: {
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                  },
                },
              },
            ],
          },
        });

        if (!workspace) {
          throw new Error('You do not have permission to delete this activity');
        }
      } else {
        throw new Error('You do not have permission to delete this activity');
      }
    }

    await prisma.activity.delete({
      where: { id: activityId },
    });

    return true;
  },

  async clearUserActivities(
    userId: string,
    filters: { workspaceId?: string; before?: Date } = {}
  ) {
    const where: any = { userId };

    if (filters.workspaceId) {
      where.workspaceId = filters.workspaceId;
    }

    if (filters.before) {
      where.createdAt = { lte: filters.before };
    }

    const result = await prisma.activity.deleteMany({ where });

    return result.count;
  },

  async checkWorkspaceAccess(userId: string, workspaceId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
    });

    return !!workspace;
  },

  async checkTaskAccess(userId: string, taskId: string) {
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

    return !!task;
  },

  async getUserActivityStats(userId: string, workspaceId?: string) {
    const where: any = {
      OR: [
        { userId },
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

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    const [totalActivities, todayActivities, actionCounts] = await Promise.all([
      prisma.activity.count({ where }),
      prisma.activity.count({
        where: {
          ...where,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.activity.groupBy({
        by: ['action'],
        where,
        _count: true,
      }),
    ]);

    const byAction = actionCounts.reduce((acc, item) => {
      acc[item.action] = item._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: totalActivities,
      today: todayActivities,
      byAction,
    };
  },

  async getGroupedActivities(userId: string, workspaceId?: string, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await this.getUserActivities(userId, {
      workspaceId,
      startDate,
      limit: 100,
    });

    const grouped = activities.reduce((acc, activity) => {
      const date = new Date(activity.createdAt).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(activity);
      return acc;
    }, {} as Record<string, typeof activities>);

    return grouped;
  },
};