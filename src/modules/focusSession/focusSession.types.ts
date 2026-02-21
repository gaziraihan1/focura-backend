/**
 * focusSession.types.ts
 * Responsibility: All types, interfaces, and error codes for the FocusSession domain.
 *
 * Error codes as a const object instead of raw strings.
 * This means: one rename here fixes it everywhere. No more
 * (error as Error).message === 'SESSION_NOT_FOUND' string matching.
 */

import { FocusType } from '@prisma/client';

export type { FocusType } from '@prisma/client';

// ─── Domain error codes ───────────────────────────────────────────────────────

/**
 * Typed error codes thrown by mutations and caught by the controller.
 * Using a const object (not enum) keeps values as literal string types.
 */
export const FocusSessionError = {
  USER_HAS_ACTIVE_SESSION:   'USER_HAS_ACTIVE_SESSION',
  SESSION_NOT_FOUND:         'SESSION_NOT_FOUND',
  SESSION_ALREADY_COMPLETED: 'SESSION_ALREADY_COMPLETED',
} as const;

export type FocusSessionErrorCode = typeof FocusSessionError[keyof typeof FocusSessionError];

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface CreateFocusSessionInput {
  userId: string;
  taskId?: string;
  type?: FocusType;
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

export interface GetFocusStatsInput {
  userId: string;
  startDate?: Date;
  endDate?: Date;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface FocusStats {
  totalSessions: number;
  totalMinutes: number;
  completedToday: number;
  averageSessionLength: number;
}

export interface FocusStatsWithStreak extends FocusStats {
  focusStreak: number;
}