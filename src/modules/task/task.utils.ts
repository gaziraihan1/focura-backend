/**
 * task.utils.ts
 * Responsibility: Pure utility functions for the Task domain.
 *
 * `getTimeStatus` was called 100+ times in the original (once per task in a list).
 * Now extracted as a pure function that can be:
 *  - Unit tested without any DB
 *  - Optimized by capturing `now` once per batch
 *  - Potentially memoized if the same task is computed twice
 */

import type { TaskForTimeTracking, TimeTracking } from './task.types.js';

/**
 * Computes time-based metrics for a task.
 *
 * Performance: the original called `new Date()` twice inside this function
 * on every task in a list. For 100 tasks that's 200 Date objects created.
 * Now `now` is passed in so the caller can create it once.
 */
export function getTimeStatus(task: TaskForTimeTracking, now = new Date()): TimeTracking {
  const createdAt = new Date(task.createdAt);
  const dueDate   = task.dueDate ? new Date(task.dueDate) : null;

  const hoursSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

  let hoursUntilDue: number | null = null;
  let isOverdue   = false;
  let isDueToday  = false;

  if (dueDate) {
    const msUntilDue = dueDate.getTime() - now.getTime();
    hoursUntilDue    = Math.floor(msUntilDue / (1000 * 60 * 60));

    // Three overdue calculation strategies
    if (task.estimatedHours && task.actualHours) {
      isOverdue = task.actualHours > task.estimatedHours;
    } else if (task.estimatedHours) {
      isOverdue = hoursSinceCreation > task.estimatedHours;
    } else {
      isOverdue = now > dueDate;
    }

    // Due today check
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    isDueToday = dueDate >= todayStart && dueDate <= todayEnd;
  }

  return {
    hoursSinceCreation,
    hoursUntilDue,
    isOverdue: task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && isOverdue,
    isDueToday,
    timeProgress: task.estimatedHours
      ? Math.min(100, Math.round((hoursSinceCreation / task.estimatedHours) * 100))
      : null,
  };
}

/**
 * Batch version — computes time tracking for multiple tasks with a single `now`.
 * Performance: for 100 tasks, creates 1 Date object instead of 200.
 */
export function getTimeStatusBatch(tasks: TaskForTimeTracking[]): Map<string, TimeTracking> {
  const now    = new Date();
  const result = new Map<string, TimeTracking>();

  for (const task of tasks) {
    // Assumes tasks have an `id` field — caller should cast if needed
    result.set((task as any).id, getTimeStatus(task, now));
  }

  return result;
}