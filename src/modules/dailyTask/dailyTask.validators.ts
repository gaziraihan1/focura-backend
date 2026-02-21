/**
 * dailyTask.validators.ts
 * Responsibility: Request validation schemas for the DailyTask domain.
 *
 * Replaces the original controller's manual if-checks:
 *   if (!taskId) return 400
 *   if (!['PRIMARY','SECONDARY'].includes(type)) return 400
 *
 * Zod gives us:
 *  - Type-safe parsed output (no `as string` casts needed).
 *  - Consistent error shape across all endpoints.
 *  - Schemas that are testable in isolation.
 */

import { z } from 'zod';

/** GET /?date=... */
export const getDailyTasksSchema = z.object({
  date: z.coerce.date().optional(),
});

/** POST / body */
export const addDailyTaskSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  type:   z.enum(['PRIMARY', 'SECONDARY'], {
    message: 'Type must be either PRIMARY or SECONDARY',
  }),
  date: z.coerce.date().optional(),
});

/** DELETE /:taskId?date=... */
export const removeDailyTaskSchema = z.object({
  date: z.coerce.date().optional(),
});

/** GET /stats?startDate=...&endDate=... */
export const dailyTaskStatsSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate:   z.coerce.date().optional(),
});

// Inferred types
export type AddDailyTaskBody       = z.infer<typeof addDailyTaskSchema>;
export type DailyTaskStatsQuery    = z.infer<typeof dailyTaskStatsSchema>;