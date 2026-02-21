/**
 * calendar.validators.ts
 * Responsibility: Request validation schemas for the Calendar domain.
 *
 * Why a separate file:
 *  Your original controller had the same Zod parse + ZodError catch block
 *  copy-pasted in every handler (7 times). Extracting schemas here means:
 *   - One place to change a validation rule.
 *   - Schemas are testable in isolation.
 *   - Controller handlers stay thin.
 */

import { z } from 'zod';

/** Shared date-range + optional workspace filter — used by most GET endpoints */
export const calendarRangeSchema = z.object({
  workspaceId: z.string().optional(),
  startDate:   z.coerce.date(),
  endDate:     z.coerce.date(),
});

/** POST /goals body */
export const createGoalCheckpointSchema = z.object({
  workspaceId: z.string().optional(),
  title:       z.string().min(1, 'Title is required'),
  type:        z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'KPI']),
  targetDate:  z.coerce.date(),
});

/** POST /recalculate body */
export const recalculateSchema = z.object({
  workspaceId: z.string().optional(),
  date:        z.coerce.date(),
});

// Inferred types so controllers stay type-safe without redeclaring
export type CalendarRangeInput        = z.infer<typeof calendarRangeSchema>;
export type CreateGoalCheckpointInput = z.infer<typeof createGoalCheckpointSchema>;
export type RecalculateInput          = z.infer<typeof recalculateSchema>;