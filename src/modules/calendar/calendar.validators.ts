import { z } from 'zod';

export const calendarRangeSchema = z.object({
  workspaceId: z.string().optional(),
  startDate:   z.coerce.date(),
  endDate:     z.coerce.date(),
});

export const createGoalCheckpointSchema = z.object({
  workspaceId: z.string().optional(),
  title:       z.string().min(1, 'Title is required'),
  type:        z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'KPI']),
  targetDate:  z.coerce.date(),
});

export const recalculateSchema = z.object({
  workspaceId: z.string().optional(),
  date:        z.coerce.date(),
});

export type CalendarRangeInput        = z.infer<typeof calendarRangeSchema>;
export type CreateGoalCheckpointInput = z.infer<typeof createGoalCheckpointSchema>;
export type RecalculateInput          = z.infer<typeof recalculateSchema>;