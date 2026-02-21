/**
 * activity.analytics.ts
 * Responsibility: Aggregation and analytics queries for the Activity domain.
 *
 * Kept separate from activity.query.ts because:
 *  - These use GROUP BY and COUNT — very different DB query profile.
 *  - They're candidates for caching (Redis TTL) independently of row fetches.
 *  - Adding a new stat doesn't risk breaking the plain read queries.
 */

import { prisma } from '../../index.js';
import type { ActivityStats } from './activity.types.js';
import { ActivityQuery } from './activity.query.js';

export const ActivityAnalytics = {
  /**
   * Returns total count, today's count, and a per-action breakdown
   * for activities visible to the given user.
   */
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

  /**
   * Groups activities by calendar date over the last `days` days.
   * Useful for timeline feeds and activity heatmaps.
   *
   * Example return:
   *   { "2/17/2026": [activity, activity], "2/16/2026": [activity] }
   */
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