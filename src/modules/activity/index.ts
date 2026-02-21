/**
 * activity/index.ts
 * Responsibility: Public API surface of the Activity module.
 *
 * Every other module in the app imports from here ONLY.
 * Never import directly from internal files like activity.query.ts.
 *
 * This indirection means you can freely refactor internals
 * (rename a file, split a service further) without touching any caller.
 *
 * Usage:
 *   import { ActivityQuery, ActivityMutation } from '../modules/activity/index.js';
 *   import type { ActivityFilters, CreateActivityParams } from '../modules/activity/index.js';
 */

// ─── Services ─────────────────────────────────────────────────────────────────
export { ActivityQuery }     from './activity.query.js';
export { ActivityMutation }  from './activity.mutation.js';
export { ActivityAnalytics } from './activity.analytics.js';
export { ActivityAccess }    from './activity.access.js';

// ─── Router (for app.ts / main router registration) ──────────────────────────
export { default as activityRouter } from './activity.routes.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  ActivityType,
  EntityType,
  ActivityFilters,
  WorkspaceActivityFilters,
  TaskActivityFilters,
  ClearActivitiesFilters,
  CreateActivityParams,
  ActivityStats,
  PaginatedMeta,
} from './activity.types.js';