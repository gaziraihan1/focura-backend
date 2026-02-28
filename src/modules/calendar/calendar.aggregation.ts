
import { prisma } from '../../index.js';
import type { CalendarDayAggregate } from './calendar.types.js';
import type { CalendarFilters } from './calendar.types.js';
import {
  normalizeDate,
  endOfDay,
  generateDateRange,
  isReviewDay,
} from './calendar.utils.js';

export const CalendarAggregation = {
  async getOrComputeAggregates(filters: CalendarFilters): Promise<CalendarDayAggregate[]> {
    const { userId, workspaceId, startDate, endDate } = filters;

    const existing = await prisma.calendarDayAggregate.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    if (existing.length === 0) {
      await this.computeRange(userId, workspaceId, startDate, endDate);
      return this.getOrComputeAggregates(filters);
    }

    const existingDates = new Set(
      existing.map((agg) => agg.date.toISOString().split('T')[0]),
    );
    const missing = generateDateRange(startDate, endDate).filter(
      (d) => !existingDates.has(d.toISOString().split('T')[0]),
    );

    if (missing.length > 0) {
      await Promise.all(
        missing.map((date) => this.recalculateDay(userId, workspaceId, date)),
      );
      return this.getOrComputeAggregates(filters);
    }

    return existing;
  },

  async computeRange(
    userId: string,
    workspaceId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    const dates = generateDateRange(startDate, endDate);
    await Promise.all(
      dates.map((date) => this.recalculateDay(userId, workspaceId, date)),
    );
  },

  async recalculateDay(
    userId: string,
    workspaceId: string | undefined,
    date: Date,
  ): Promise<void> {
    const dayStart = normalizeDate(date);
    const dayEnd   = endOfDay(date);

    const [capacity, tasks, timeEntries, focusSessions, dailyTasks, milestones] =
      await Promise.all([
        prisma.userCapacity.findUnique({ where: { userId } }),

        prisma.task.findMany({
          where: {
            createdById: userId,
            ...(workspaceId ? { workspaceId } : {}),
            OR: [
              { dueDate:   { gte: dayStart, lte: dayEnd } },
              { startDate: { gte: dayStart, lte: dayEnd } },
            ],
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          include: { assignees: true },
        }),

        prisma.timeEntry.findMany({
          where: {
            userId,
            startedAt: { gte: dayStart, lte: dayEnd },
          },
        }),

        prisma.focusSession.findMany({
          where: {
            userId,
            startedAt:  { gte: dayStart, lte: dayEnd },
            completed:  true,
          },
        }),

        prisma.dailyTask.findMany({
          where: {
            userId,
            date: { gte: dayStart, lte: dayEnd },
          },
        }),

        prisma.projectMilestone.findMany({
          where: {
            dueDate: { gte: dayStart, lte: dayEnd },
            project: {
              ...(workspaceId ? { workspaceId } : {}),
              members: { some: { userId } },
            },
          },
        }),
      ]);

    const dailyCapacity   = capacity?.dailyCapacityHours ?? 8;
    const totalTasks      = tasks.length;
    const dueTasks        = tasks.filter((t) => t.dueDate && t.dueDate >= dayStart && t.dueDate <= dayEnd).length;
    const criticalTasks   = tasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH').length;
    const milestoneCount  = milestones.length;

    const plannedHours    = tasks.reduce((sum, t) => sum + (t.estimatedHours ?? 0), 0);
    const actualHours     = timeEntries.reduce((sum, e) => sum + e.duration / 60, 0);
    const focusMinutes    = focusSessions.reduce((sum, s) => sum + s.duration, 0);

    const focusRequiredTasks = tasks.filter((t) => t.focusRequired).length;

    const workloadScore =
      plannedHours / dailyCapacity +
      criticalTasks * 0.5 +
      focusRequiredTasks * 0.3;

    const overCapacity    = plannedHours > dailyCapacity;
    const hasPrimaryFocus = dailyTasks.some((dt) => dt.type === 'PRIMARY');
    const reviewDay       = isReviewDay(dayStart);

    await prisma.calendarDayAggregate.upsert({
      where:  { userId_date: { userId, date: dayStart } },
      update: {
        totalTasks, dueTasks, criticalTasks, milestoneCount,
        plannedHours, actualHours, focusMinutes,
        workloadScore, overCapacity, hasPrimaryFocus, isReviewDay: reviewDay,
      },
      create: {
        userId, date: dayStart,
        totalTasks, dueTasks, criticalTasks, milestoneCount,
        plannedHours, actualHours, focusMinutes,
        workloadScore, overCapacity, hasPrimaryFocus, isReviewDay: reviewDay,
      },
    });
  },
};