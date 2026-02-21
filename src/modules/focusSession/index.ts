/**
 * focusSession/index.ts
 * Responsibility: Public API surface of the FocusSession module.
 *
 * Usage:
 *   import { FocusSessionMutation, FocusSessionAnalytics } from '../modules/focusSession/index.js';
 *   import type { FocusStats, CreateFocusSessionInput } from '../modules/focusSession/index.js';
 */

// ─── Services ─────────────────────────────────────────────────────────────────
export { FocusSessionQuery }     from './focusSession.query.js';
export { FocusSessionMutation }  from './focusSession.mutation.js';
export { FocusSessionAnalytics } from './focusSession.analytics.js';

// ─── Error codes (exported so other modules can handle focus session errors) ──
export { FocusSessionError }     from './focusSession.types.js';

// ─── Router ───────────────────────────────────────────────────────────────────
export { default as focusSessionRouter } from './focusSession.routes.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  FocusType,
  FocusSessionErrorCode,
  CreateFocusSessionInput,
  CompleteFocusSessionInput,
  CancelFocusSessionInput,
  GetFocusHistoryInput,
  GetFocusStatsInput,
  FocusStats,
  FocusStatsWithStreak,
} from './focusSession.types.js';