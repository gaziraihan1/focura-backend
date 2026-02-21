/**
 * dailyTask/index.ts
 * Responsibility: Public API surface of the DailyTask module.
 *
 * Every other module imports from here ONLY — never from internal files.
 *
 * Usage:
 *   import { DailyTaskQuery, DailyTaskMutation } from '../modules/dailyTask/index.js';
 *   import type { DailyTaskStats, AddDailyTaskParams } from '../modules/dailyTask/index.js';
 */

// ─── Services ─────────────────────────────────────────────────────────────────
export { DailyTaskQuery }    from './dailyTask.query.js';
export { DailyTaskMutation } from './dailyTask.mutation.js';
export { DailyTaskAccess }   from './dailyTask.access.js';
export { DailyTaskActivity } from './dailyTask.activity.js';

// ─── Router ───────────────────────────────────────────────────────────────────
export { default as dailyTaskRouter } from './dailyTask.routes.js';

// ─── Cron ─────────────────────────────────────────────────────────────────────
export { initDailyTaskCrons } from './dailyTask.cron.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  DailyTaskType,
  GetDailyTasksParams,
  GetDailyTaskStatsParams,
  AddDailyTaskParams,
  RemoveDailyTaskParams,
  DailyTaskStats,
  ClearExpiredResult,
} from './dailyTask.types.js';