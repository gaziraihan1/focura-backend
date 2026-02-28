
import { z } from 'zod';

export const startSessionSchema = z.object({
  taskId:   z.string().optional(),
  type:     z.enum(['POMODORO', 'SHORT_BREAK', 'LONG_BREAK', 'DEEP_WORK', 'CUSTOM']),
  duration: z.number().min(1).max(480), // 1–480 minutes
});

export const getHistorySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const getStatsSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate:   z.coerce.date().optional(),
});

export type StartSessionBody = z.infer<typeof startSessionSchema>;
export type GetHistoryQuery  = z.infer<typeof getHistorySchema>;
export type GetStatsQuery    = z.infer<typeof getStatsSchema>;