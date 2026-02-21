/**
 * focusSession.validators.ts
 * Responsibility: Request validation schemas for the FocusSession domain.
 *
 * Extracted from the controller where they were defined inline.
 * Added statsSchema — the controller was calling getStats with
 * raw `req.query` casts; now it goes through Zod too.
 */

import { z } from 'zod';

/** POST /start body */
export const startSessionSchema = z.object({
  taskId:   z.string().optional(),
  type:     z.enum(['POMODORO', 'SHORT_BREAK', 'LONG_BREAK', 'DEEP_WORK', 'CUSTOM']),
  duration: z.number().min(1).max(480), // 1–480 minutes
});

/** GET /history?limit=... */
export const getHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** GET /stats?startDate=...&endDate=... */
export const getStatsSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate:   z.coerce.date().optional(),
});

// Inferred types
export type StartSessionBody = z.infer<typeof startSessionSchema>;
export type GetHistoryQuery  = z.infer<typeof getHistorySchema>;
export type GetStatsQuery    = z.infer<typeof getStatsSchema>;