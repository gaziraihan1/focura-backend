/**
 * dailyTask.query.ts
 * Responsibility: Read-only SELECT operations for the DailyTask domain.
 *
 * Rules:
 *  - No writes, no auth checks, no activity logging.
 *  - Returns typed results using shared select fragments.
 */

import { prisma } from '../../index.js';
import type { GetDailyTasksParams, GetDailyTaskStatsParams, DailyTaskStats } from './dailyTask.types.js';
import { taskFullInclude, taskStatsSelect } from './dailyTask.selects.js';

/** Day boundary helpers — local to this file, no side effects */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export const DailyTaskQuery = {
  /**
   * Returns the user's primary and secondary tasks for a given day,
   * ordered PRIMARY first then by addedAt.
   */
  async getDailyTasks(params: GetDailyTasksParams) {
    const dayStart = startOfDay(params.date);
    const dayEnd   = endOfDay(params.date);

    const dailyTasks = await prisma.dailyTask.findMany({
      where: {
        userId: params.userId,
        date: { gte: dayStart, lte: dayEnd },
      },
      include: { task: { include: taskFullInclude } },
      orderBy: [
        { type:    'asc' }, // PRIMARY sorts before SECONDARY alphabetically
        { addedAt: 'asc' },
      ],
    });

    return {
      primaryTask:    dailyTasks.find((dt) => dt.type === 'PRIMARY') ?? null,
      secondaryTasks: dailyTasks.filter((dt) => dt.type === 'SECONDARY'),
    };
  },

  /**
   * Returns completion-rate stats for a date range.
   * Used for progress dashboards and cron-generated reports.
   */
  async getDailyTaskStats(params: GetDailyTaskStatsParams): Promise<DailyTaskStats> {
    const dailyTasks = await prisma.dailyTask.findMany({
      where: {
        userId: params.userId,
        date: { gte: params.startDate, lte: params.endDate },
      },
      include: { task: { select: taskStatsSelect } },
    });

    const primary   = dailyTasks.filter((dt) => dt.type === 'PRIMARY');
    const secondary = dailyTasks.filter((dt) => dt.type === 'SECONDARY');

    const completedPrimary   = primary.filter((dt) => dt.task.status === 'COMPLETED');
    const completedSecondary = secondary.filter((dt) => dt.task.status === 'COMPLETED');

    const totalDays = Math.ceil(
      (params.endDate.getTime() - params.startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      totalDays,
      primaryTasksSet:          primary.length,
      secondaryTasksSet:        secondary.length,
      primaryTasksCompleted:    completedPrimary.length,
      secondaryTasksCompleted:  completedSecondary.length,
      primaryCompletionRate:    primary.length > 0
        ? (completedPrimary.length / primary.length) * 100
        : 0,
      secondaryCompletionRate: secondary.length > 0
        ? (completedSecondary.length / secondary.length) * 100
        : 0,
    };
  },
};