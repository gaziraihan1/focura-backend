
import { prisma } from '../../lib/prisma.js';
import type { GoalCheckpoint, CreateGoalCheckpointInput } from './calendar.types.js';

export const CalendarMutation = {
  async createGoalCheckpoint(data: CreateGoalCheckpointInput): Promise<GoalCheckpoint> {
    return prisma.goalCheckpoint.create({
      data: {
        userId:      data.userId,
        workspaceId: data.workspaceId,
        title:       data.title,
        type:        data.type,
        targetDate:  data.targetDate,
      },
    });
  },

  async initializeUserSettings(userId: string): Promise<void> {
    await Promise.all([
      prisma.userCapacity.upsert({
        where:  { userId },
        update: {},
        create: {
          userId,
          weeklyHours:         40,
          dailyCapacityHours:  8,
          deepWorkHours:       4,
        },
      }),

      prisma.userWorkSchedule.upsert({
        where:  { userId },
        update: {},
        create: {
          userId,
          workDays:       ['MON', 'TUE', 'WED', 'THU', 'FRI'],
          workStartHour:  9,
          workEndHour:    17,
        },
      }),
    ]);
  },
};