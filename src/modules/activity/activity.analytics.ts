
import { prisma } from '../../lib/prisma.js';
import type { ActivityStats } from './activity.types.js';
import { ActivityQuery } from './activity.query.js';

export const ActivityAnalytics = {
  async getUserActivityStats(
    userId: string,
    workspaceId?: string,
  ): Promise<ActivityStats> {
    const where: Record<string, unknown> = {
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

    if (workspaceId) where.workspaceId = workspaceId;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [total, today, actionCounts] = await Promise.all([
      prisma.activity.count({ where }),

      prisma.activity.count({
        where: { ...where, createdAt: { gte: startOfToday } },
      }),

      prisma.activity.groupBy({
        by: ['action'],
        where,
        _count: true,
      }),
    ]);

    const byAction = actionCounts.reduce<Record<string, number>>((acc, item) => {
      acc[item.action] = item._count;
      return acc;
    }, {});

    return { total, today, byAction };
  },

  async getGroupedActivities(
    userId: string,
    workspaceId?: string,
    days = 7,
  ) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await ActivityQuery.getUserActivities(userId, {
      workspaceId,
      startDate,
      limit: 100,
    });

    return activities.reduce<Record<string, typeof activities>>((acc, activity) => {
      const date = new Date(activity.createdAt).toLocaleDateString();
      if (!acc[date]) acc[date] = [];
      acc[date].push(activity);
      return acc;
    }, {});
  },
};