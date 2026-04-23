
import { prisma } from '../../lib/prisma.js';
import type { SystemCalendarEvent, GoalCheckpoint } from './calendar.types.js';

export const CalendarQuery = {
  async getSystemEvents(
    userId: string,
    workspaceId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<SystemCalendarEvent[]> {
    return prisma.systemCalendarEvent.findMany({
      where: {
        OR: [{ userId }, { workspaceId }],
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });
  },

  async getGoalCheckpoints(
    userId: string,
    workspaceId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<GoalCheckpoint[]> {
    return prisma.goalCheckpoint.findMany({
      where: {
        userId,
        ...(workspaceId ? { workspaceId } : {}),
        targetDate: { gte: startDate, lte: endDate },
      },
      orderBy: { targetDate: 'asc' },
    });
  },
};