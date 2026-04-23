
import { prisma } from '../../lib/prisma.js';
import type { GetFocusStatsInput, FocusStats } from './focusSession.types.js';

export const FocusSessionAnalytics = {
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

  async getFocusStreak(userId: string): Promise<number> {
    const sessions = await prisma.focusSession.findMany({
      where:   { userId, completed: true },
      select:  { startedAt: true },
      orderBy: { startedAt: 'desc' },
    });

    if (sessions.length === 0) return 0;

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