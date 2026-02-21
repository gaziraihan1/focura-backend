/**
 * task/index.ts
 * Responsibility: Public API surface of the Task module.
 *
 * Usage:
 *   import { TaskQuery, TaskMutation } from '../modules/task/index.js';
 *   import type { CreateTaskInput, TaskStats } from '../modules/task/index.js';
 */

// ─── Services ─────────────────────────────────────────────────────────────────
export { TaskQuery }         from './task.query.js';
export { TaskMutation }      from './task.mutation.js';
export { TaskAccess }        from './task.access.js';
export { TaskFilters }       from './task.filters.js';
export { TaskActivity }      from './task.activity.js';
export { TaskNotifications } from './task.notifications.js';

// ─── Utils (exported for reuse) ───────────────────────────────────────────────
export { getTimeStatus, getTimeStatusBatch } from './task.utils.js';

// ─── Router ───────────────────────────────────────────────────────────────────
export { default as taskRouter } from './task.routes.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  TaskStatus,
  TaskPriority,
  TaskIntent,
  EnergyType,
  TaskFilterParams,
  PaginationParams,
  SortParams,
  CreateTaskInput,
  UpdateTaskInput,
  TimeTracking,
  TaskStats,
  PaginatedTasksResult,
  EditPermissionResult,
} from './task.types.js';