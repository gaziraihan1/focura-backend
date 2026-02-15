import { prisma } from "../index.js";
import type { 
  CalendarDayAggregate, 
  BurnoutSignal, 
  GoalCheckpoint, 
  SystemCalendarEvent 
} from '@prisma/client';

interface CalendarFilters {
  userId: string;
  workspaceId?: string;
  startDate: Date;
  endDate: Date;
}

interface TimeAllocation {
  deepWork: number;
  meetings: number;
  admin: number;
  learning: number;
}

interface CalendarInsights {
  totalPlannedHours: number;
  totalCapacityHours: number;
  commitmentGap: number;
  overloadedDays: number;
  focusDays: number;
  burnoutRisk: string;
  timeAllocation: TimeAllocation | null; // null if we don't have real data
}

interface CreateGoalCheckpointInput {
  userId: string;
  workspaceId?: string;
  title: string;
  type: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'KPI';
  targetDate: Date;
}

export class CalendarService {
  /**
   * Get calendar day aggregates for a date range
   */
  static async getCalendarAggregates(filters: CalendarFilters): Promise<CalendarDayAggregate[]> {
    const { userId, workspaceId, startDate, endDate } = filters;

    const aggregates = await prisma.calendarDayAggregate.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // If no aggregates exist, compute them
    if (aggregates.length === 0) {
      await this.computeAggregatesForRange(userId, workspaceId, startDate, endDate);
      return this.getCalendarAggregates(filters);
    }

    // ✅ FIX #6: Only compute missing days, not all days
    const expectedDates = this.generateDateRange(startDate, endDate);
    const existingDates = new Set(aggregates.map(agg => agg.date.toISOString().split('T')[0]));
    const missingDates = expectedDates.filter(
      date => !existingDates.has(date.toISOString().split('T')[0])
    );

    if (missingDates.length > 0) {
      await Promise.all(
        missingDates.map(date => this.recalculateAggregate(userId, workspaceId, date))
      );
      return this.getCalendarAggregates(filters);
    }

    return aggregates;
  }

  /**
   * Compute aggregates for a date range
   */
  static async computeAggregatesForRange(
    userId: string,
    workspaceId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    const dates = this.generateDateRange(startDate, endDate);
    
    // ✅ FIX #2: Run in parallel instead of sequential
    await Promise.all(
      dates.map(date => this.recalculateAggregate(userId, workspaceId, date))
    );
  }

  /**
   * Recalculate aggregate for a specific date
   */
  static async recalculateAggregate(
    userId: string,
    workspaceId: string | undefined,
    date: Date
  ): Promise<void> {
    const normalizedDate = this.normalizeDate(date);
    
    // ✅ FIX #1: Use date range for the entire day (00:00 - 23:59)
    const dayStart = new Date(normalizedDate);
    const dayEnd = new Date(normalizedDate);
    dayEnd.setHours(23, 59, 59, 999);

    // ✅ FIX #2: Fetch all data in parallel
    const [capacity, tasks, timeEntries, focusSessions, dailyTasks, milestones] = await Promise.all([
      prisma.userCapacity.findUnique({ where: { userId } }),
      prisma.task.findMany({
        where: {
          createdById: userId,
          ...(workspaceId ? { workspaceId } : {}),
          OR: [
            {
              dueDate: {
                gte: dayStart,
                lte: dayEnd,
              },
            },
            {
              startDate: {
                gte: dayStart,
                lte: dayEnd,
              },
            },
          ],
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
        include: {
          assignees: true,
        },
      }),
      prisma.timeEntry.findMany({
        where: {
          userId,
          startedAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      }),
      prisma.focusSession.findMany({
        where: {
          userId,
          startedAt: {
            gte: dayStart,
            lte: dayEnd,
          },
          completed: true,
        },
      }),
      prisma.dailyTask.findMany({
        where: {
          userId,
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      }),
      prisma.projectMilestone.findMany({
        where: {
          dueDate: {
            gte: dayStart,
            lte: dayEnd,
          },
          project: {
            ...(workspaceId ? { workspaceId } : {}),
            members: {
              some: {
                userId,
              },
            },
          },
        },
      }),
    ]);

    const dailyCapacity = capacity?.dailyCapacityHours || 8;

    // Calculate metrics
    const totalTasks = tasks.length;
    const dueTasks = tasks.filter((t) => 
      t.dueDate && t.dueDate >= dayStart && t.dueDate <= dayEnd
    ).length;
    const criticalTasks = tasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH').length;
    const milestoneCount = milestones.length;

    const plannedHours = tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
    const actualHours = timeEntries.reduce((sum, entry) => sum + entry.duration / 60, 0);
    const focusMinutes = focusSessions.reduce((sum, session) => sum + session.duration, 0);

    const focusRequiredTasks = tasks.filter((t) => t.focusRequired).length;

    // Workload score formula
    const workloadScore =
      plannedHours / dailyCapacity +
      criticalTasks * 0.5 +
      focusRequiredTasks * 0.3;

    const overCapacity = plannedHours > dailyCapacity;
    const hasPrimaryFocus = dailyTasks.some((dt) => dt.type === 'PRIMARY');

    // Check if it's a review day (Sunday or 1st of month)
    const isReviewDay = normalizedDate.getDay() === 0 || normalizedDate.getDate() === 1;

    // Upsert aggregate
    await prisma.calendarDayAggregate.upsert({
      where: {
        userId_date: {
          userId,
          date: normalizedDate,
        },
      },
      update: {
        totalTasks,
        dueTasks,
        criticalTasks,
        milestoneCount,
        plannedHours,
        actualHours,
        focusMinutes,
        workloadScore,
        overCapacity,
        hasPrimaryFocus,
        isReviewDay,
      },
      create: {
        userId,
        date: normalizedDate,
        totalTasks,
        dueTasks,
        criticalTasks,
        milestoneCount,
        plannedHours,
        actualHours,
        focusMinutes,
        workloadScore,
        overCapacity,
        hasPrimaryFocus,
        isReviewDay,
      },
    });
  }

  /**
   * Get calendar insights for a period
   */
  static async getCalendarInsights(
    userId: string,
    workspaceId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<CalendarInsights> {
    const aggregates = await this.getCalendarAggregates({
      userId,
      workspaceId,
      startDate,
      endDate,
    });

    const [capacity, schedule] = await Promise.all([
      prisma.userCapacity.findUnique({ where: { userId } }),
      prisma.userWorkSchedule.findUnique({ where: { userId } }),
    ]);

    const workDays = (schedule?.workDays as string[]) || ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const workDaysCount = this.countWorkDays(startDate, endDate, workDays);
    const dailyCapacity = capacity?.dailyCapacityHours || 8;

    const totalPlannedHours = aggregates.reduce((sum, agg) => sum + agg.plannedHours, 0);
    const totalCapacityHours = workDaysCount * dailyCapacity;
    const commitmentGap = totalPlannedHours - totalCapacityHours;
    const overloadedDays = aggregates.filter((agg) => agg.overCapacity).length;
    const focusDays = aggregates.filter((agg) => agg.hasPrimaryFocus).length;

    // Calculate burnout risk
    const burnoutRisk = await this.calculateBurnoutRisk(userId, startDate);

    // ✅ FIX #3: Don't show fake time allocation data
    // Only show if we have real category tracking
    const timeAllocation = null; // Set to null until you implement real category tracking

    return {
      totalPlannedHours,
      totalCapacityHours,
      commitmentGap,
      overloadedDays,
      focusDays,
      burnoutRisk: burnoutRisk.riskLevel,
      timeAllocation,
    };
  }

  /**
   * Calculate burnout risk
   */
  static async calculateBurnoutRisk(userId: string, weekStart: Date): Promise<BurnoutSignal> {
    const normalizedWeekStart = this.normalizeDate(weekStart);
    normalizedWeekStart.setDate(normalizedWeekStart.getDate() - normalizedWeekStart.getDay());

    const weekEnd = new Date(normalizedWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // ✅ FIX #4: Get user's work schedule for accurate burnout calculation
    const [aggregates, schedule] = await Promise.all([
      this.getCalendarAggregates({
        userId,
        startDate: normalizedWeekStart,
        endDate: weekEnd,
      }),
      prisma.userWorkSchedule.findUnique({ where: { userId } }),
    ]);

    const workDays = (schedule?.workDays as string[]) || ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const workDayNumbers = this.getWorkDayNumbers(workDays);

    // ✅ FIX #4: Only count workdays for burnout calculation
    const workdayAggregates = aggregates.filter(agg => 
      workDayNumbers.includes(agg.date.getDay())
    );

    const heavyDays = workdayAggregates.filter((agg) => agg.workloadScore > 1.2);
    const consecutiveHeavyDays = this.countConsecutiveDays(workdayAggregates, (agg) => agg.workloadScore > 1.2);
    const avgDailyLoad = workdayAggregates.length > 0 
      ? workdayAggregates.reduce((sum, agg) => sum + agg.workloadScore, 0) / workdayAggregates.length 
      : 0;

    let riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' = 'LOW';

    if (consecutiveHeavyDays >= 5 || avgDailyLoad > 1.5) {
      riskLevel = 'CRITICAL';
    } else if (consecutiveHeavyDays >= 3 || avgDailyLoad > 1.2) {
      riskLevel = 'HIGH';
    } else if (heavyDays.length >= 2 || avgDailyLoad > 1.0) {
      riskLevel = 'MODERATE';
    }

    // Upsert burnout signal
    const signal = await prisma.burnoutSignal.upsert({
      where: {
        userId_weekStart: {
          userId,
          weekStart: normalizedWeekStart,
        },
      },
      update: {
        consecutiveHeavyDays,
        avgDailyLoad,
        riskLevel,
      },
      create: {
        userId,
        weekStart: normalizedWeekStart,
        consecutiveHeavyDays,
        avgDailyLoad,
        riskLevel,
      },
    });

    return signal;
  }

  /**
   * Get system calendar events
   */
  static async getSystemEvents(
    userId: string,
    workspaceId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<SystemCalendarEvent[]> {
    return prisma.systemCalendarEvent.findMany({
      where: {
        OR: [
          { userId },
          { workspaceId },
        ],
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  /**
   * Get goal checkpoints
   */
  static async getGoalCheckpoints(
    userId: string,
    workspaceId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<GoalCheckpoint[]> {
    return prisma.goalCheckpoint.findMany({
      where: {
        userId,
        ...(workspaceId ? { workspaceId } : {}),
        targetDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        targetDate: 'asc',
      },
    });
  }

  /**
   * Create goal checkpoint
   */
  static async createGoalCheckpoint(data: CreateGoalCheckpointInput): Promise<GoalCheckpoint> {
    return prisma.goalCheckpoint.create({
      data: {
        userId: data.userId,
        workspaceId: data.workspaceId,
        title: data.title,
        type: data.type,
        targetDate: data.targetDate,
      },
    });
  }

  /**
   * Initialize user capacity and schedule
   */
  static async initializeUserSettings(userId: string): Promise<void> {
    // Create default capacity and schedule in parallel
    await Promise.all([
      prisma.userCapacity.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          weeklyHours: 40,
          dailyCapacityHours: 8,
          deepWorkHours: 4,
        },
      }),
      prisma.userWorkSchedule.upsert({
        where: { userId },
        update: {},
        create: {
          userId,
          workDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
          workStartHour: 9,
          workEndHour: 17,
        },
      }),
    ]);
  }

  // Helper methods

  private static normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private static generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const current = this.normalizeDate(startDate);
    const end = this.normalizeDate(endDate);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  private static getWorkDayNumbers(workDays: string[]): number[] {
    const dayMap: Record<string, number> = {
      SUN: 0,
      MON: 1,
      TUE: 2,
      WED: 3,
      THU: 4,
      FRI: 5,
      SAT: 6,
    };

    return workDays
      .map((day) => dayMap[day])
      .filter((num): num is number => num !== undefined);
  }

  private static countWorkDays(startDate: Date, endDate: Date, workDays: string[]): number {
    const workDayNumbers = this.getWorkDayNumbers(workDays);
    const dates = this.generateDateRange(startDate, endDate);

    return dates.filter((date) => workDayNumbers.includes(date.getDay())).length;
  }

  private static countConsecutiveDays(
    aggregates: CalendarDayAggregate[],
    condition: (agg: CalendarDayAggregate) => boolean
  ): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const agg of aggregates) {
      if (condition(agg)) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 0;
      }
    }

    return maxConsecutive;
  }
}