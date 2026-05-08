import { z } from 'zod';

export const getDailyTasksSchema = z.object({
  date: z.coerce.date().optional(),
});

export const addDailyTaskSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  type:   z.enum(['PRIMARY', 'SECONDARY'], {
    message: 'Type must be either PRIMARY or SECONDARY',
  }),
  date: z.coerce.date().optional(),
});

export const removeDailyTaskSchema = z.object({
  date: z.coerce.date().optional(),
});

export const dailyTaskStatsSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate:   z.coerce.date().optional(),
});

export type AddDailyTaskBody       = z.infer<typeof addDailyTaskSchema>;
export type DailyTaskStatsQuery    = z.infer<typeof dailyTaskStatsSchema>;