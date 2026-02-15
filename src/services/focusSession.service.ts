// services/focus-session.service.ts

import { prisma } from '../index.js';
import { FocusType } from '@prisma/client';
import { CalendarService } from './calendar.service.js';

export interface CreateFocusSessionInput {
  userId: string;
  taskId?: string;
  type: FocusType;
  duration: number;
}

export interface CompleteFocusSessionInput {
  sessionId: string;
  userId: string;
}

export interface CancelFocusSessionInput {
  sessionId: string;
  userId: string;
}

export interface GetFocusHistoryInput {
  userId: string;
  limit?: number;
}

export class FocusSessionService {
  /**
   * Check if user has an active focus session
   */
  static async getActiveSession(userId: string) {
    return await prisma.focusSession.findFirst({
      where: {
        userId,
        completed: false,
        endedAt: null,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    });
  }

  /**
   * Start a new focus session
   * @throws Error if user already has an active session
   */
  static async startSession(input: CreateFocusSessionInput) {
    const { userId, taskId, type, duration } = input;

    // Check for existing active session
    const activeSession = await this.getActiveSession(userId);

    if (activeSession) {
      throw new Error('USER_HAS_ACTIVE_SESSION');
    }

    // Create new session
    const session = await prisma.focusSession.create({
      data: {
        userId,
        taskId,
        type,
        duration,
        startedAt: new Date(),
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return session;
  }

  /**
   * Complete an existing focus session
   * @throws Error if session not found or already completed
   */
  static async completeSession(input: CompleteFocusSessionInput) {
    const { sessionId, userId } = input;

    // Find session
    const session = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: {
        task: true,
      },
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    if (session.completed) {
      throw new Error('SESSION_ALREADY_COMPLETED');
    }

    // Update session
    const updatedSession = await prisma.focusSession.update({
      where: { id: sessionId },
      data: {
        completed: true,
        endedAt: new Date(),
      },
      include: {
        task: true,
      },
    });

    // Trigger calendar recalculation (async, non-blocking)
    CalendarService.recalculateAggregate(
      userId,
      updatedSession.task?.workspaceId ?? undefined,
      session.startedAt
    ).catch(err => {
      console.error('Calendar recalculation failed after focus session completion:', err);
    });

    return updatedSession;
  }

  /**
   * Cancel an active focus session
   * @throws Error if session not found
   */
  static async cancelSession(input: CancelFocusSessionInput) {
    const { sessionId, userId } = input;

    // Verify session exists and belongs to user
    const session = await prisma.focusSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    // Delete session
    await prisma.focusSession.delete({
      where: { id: sessionId },
    });

    return session;
  }

  /**
   * Get user's focus session history
   */
  static async getHistory(input: GetFocusHistoryInput) {
    const { userId, limit = 30 } = input;

    const sessions = await prisma.focusSession.findMany({
      where: {
        userId,
        completed: true,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: limit,
    });

    return sessions;
  }

  /**
   * Get focus session statistics for a user
   */
  static async getStats(userId: string, startDate?: Date, endDate?: Date) {
    const where = {
      userId,
      completed: true,
      ...(startDate && endDate
        ? {
            startedAt: {
              gte: startDate,
              lte: endDate,
            },
          }
        : {}),
    };

    const [sessions, totalMinutes] = await Promise.all([
      prisma.focusSession.count({ where }),
      prisma.focusSession.aggregate({
        where,
        _sum: {
          duration: true,
        },
      }),
    ]);

    // Get today's sessions
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const completedToday = await prisma.focusSession.count({
      where: {
        userId,
        completed: true,
        startedAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    return {
      totalSessions: sessions,
      totalMinutes: totalMinutes._sum.duration || 0,
      completedToday,
      averageSessionLength: sessions > 0 ? (totalMinutes._sum.duration || 0) / sessions : 0,
    };
  }

  /**
   * Calculate focus streak (consecutive days with completed sessions)
   */
  static async getFocusStreak(userId: string): Promise<number> {
    const sessions = await prisma.focusSession.findMany({
      where: {
        userId,
        completed: true,
      },
      select: {
        startedAt: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    if (sessions.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    // Group sessions by date
    const sessionsByDate = new Map<string, boolean>();
    sessions.forEach(session => {
      const dateKey = new Date(session.startedAt).toISOString().split('T')[0];
      sessionsByDate.set(dateKey, true);
    });

    // Count consecutive days
    while (true) {
      const dateKey = currentDate.toISOString().split('T')[0];
      
      if (sessionsByDate.has(dateKey)) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }
}