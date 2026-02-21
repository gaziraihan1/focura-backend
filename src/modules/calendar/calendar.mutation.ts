/**
 * calendar.mutation.ts
 * Responsibility: Write operations for the Calendar domain.
 *
 * Covers goal checkpoint creation and user settings initialisation.
 * Aggregate writes live in calendar.aggregation.ts — not here —
 * because they're part of a complex compute pipeline, not simple CRUD.
 */

import { prisma } from '../../index.js';
import type { GoalCheckpoint, CreateGoalCheckpointInput } from './calendar.types.js';

export const CalendarMutation = {
  /**
   * Creates a new goal checkpoint for the user.
   */
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

  /**
   * Bootstraps default capacity and work schedule for a new user.
   * Safe to call multiple times — uses upsert (no duplicates).
   *
   * Defaults:
   *  - 40h / week, 8h / day, 4h deep work
   *  - Mon–Fri, 09:00–17:00
   */
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