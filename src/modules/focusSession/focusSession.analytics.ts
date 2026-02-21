/**
 * focusSession.analytics.ts
 * Responsibility: Aggregation and streak calculations for the FocusSession domain.
 *
 * Separated from focusSession.query.ts because:
 *  - Stats use COUNT + SUM aggregate queries — different DB profile from row fetches.
 *  - getFocusStreak is a pure algorithmic calculation on top of raw date data.
 *  - These are candidates for independent caching (e.g. Redis TTL of 5 minutes).
 */

import { prisma } from '../../index.js';
import type { GetFocusStatsInput, FocusStats } from './focusSession.types.js';

export const FocusSessionAnalytics = {
  /**
   * Returns aggregate focus statistics for a user.
   * Date range is optional — omitting it returns all-time stats.
   */
  async getStats(input: GetFocusStatsInput): Promise<FocusStats> {
    const where = {
      userId:    input.userId,
      completed: true,
      ...(input.startDate && input.endDate
        ? { startedAt: { gte: input.startDate, lte: input.endDate } }
        : {}),
    };

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [sessionCount, durationAgg, completedToday] = await Promise.all([
      prisma.focusSession.count({ where }),

      prisma.focusSession.aggregate({
        where,
        _sum: { duration: true },
      }),

      prisma.focusSession.count({
        where: {
          userId:    input.userId,
          completed: true,
          startedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
    ]);

    const totalMinutes = durationAgg._sum.duration ?? 0;

    return {
      totalSessions:         sessionCount,
      totalMinutes,
      completedToday,
      averageSessionLength:  sessionCount > 0 ? totalMinutes / sessionCount : 0,
    };
  },

  /**
   * Returns the number of consecutive days (ending today) on which the user
   * completed at least one focus session.
   *
   * Algorithm: fetch all completed session dates, de-duplicate by day,
   * then walk backwards from today until a gap is found.
   */
  async getFocusStreak(userId: string): Promise<number> {
    const sessions = await prisma.focusSession.findMany({
      where:   { userId, completed: true },
      select:  { startedAt: true },
      orderBy: { startedAt: 'desc' },
    });

    if (sessions.length === 0) return 0;

    // Build a set of ISO date strings that have at least one session
    const sessionDates = new Set(
      sessions.map((s) => s.startedAt.toISOString().split('T')[0]),
    );

    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);

    while (true) {
      const key = cursor.toISOString().split('T')[0];
      if (!sessionDates.has(key)) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  },
};