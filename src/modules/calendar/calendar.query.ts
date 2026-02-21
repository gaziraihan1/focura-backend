/**
 * calendar.query.ts
 * Responsibility: Read-only SELECT operations for the Calendar domain.
 *
 * These are simple, side-effect-free fetches with no derived calculations.
 * System events and goal checkpoints are their own Prisma models — they
 * don't belong in the aggregation or insights files.
 */

import { prisma } from '../../index.js';
import type { SystemCalendarEvent, GoalCheckpoint } from './calendar.types.js';

export const CalendarQuery = {
  /**
   * Returns system-generated calendar events for a date range,
   * scoped to the user and optionally a workspace.
   */
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

  /**
   * Returns goal checkpoints for a date range,
   * optionally scoped to a workspace.
   */
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