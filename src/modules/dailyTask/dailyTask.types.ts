/**
 * dailyTask.types.ts
 * Responsibility: All types and interfaces for the DailyTask domain.
 *
 * Rules:
 *  - No imports from this module, no logic, no side effects.
 *  - Inline anonymous param objects from the original service
 *    are replaced with named interfaces here.
 */

// ─── Domain enums ──────────────────────────────────────────────────────────────

export type DailyTaskType = 'PRIMARY' | 'SECONDARY';

// ─── Query params ──────────────────────────────────────────────────────────────

export interface GetDailyTasksParams {
  userId: string;
  date: Date;
}

export interface GetDailyTaskStatsParams {
  userId: string;
  startDate: Date;
  endDate: Date;
}

// ─── Mutation params ──────────────────────────────────────────────────────────

export interface AddDailyTaskParams {
  userId: string;
  taskId: string;
  type: DailyTaskType;
  date?: Date;
}

export interface RemoveDailyTaskParams {
  userId: string;
  taskId: string;
  date?: Date;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface DailyTaskStats {
  totalDays: number;
  primaryTasksSet: number;
  secondaryTasksSet: number;
  primaryTasksCompleted: number;
  secondaryTasksCompleted: number;
  primaryCompletionRate: number;
  secondaryCompletionRate: number;
}

export interface ClearExpiredResult {
  deletedCount: number;
}