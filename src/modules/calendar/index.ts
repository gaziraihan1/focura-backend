/**
 * calendar/index.ts
 * Responsibility: Public API surface of the Calendar module.
 *
 * Every other module imports from here ONLY — never from internal files.
 *
 * Usage:
 *   import { CalendarAggregation, CalendarInsightsService } from '../modules/calendar/index.js';
 *   import type { CalendarInsights, CalendarFilters } from '../modules/calendar/index.js';
 */

// ─── Services ─────────────────────────────────────────────────────────────────
export { CalendarAggregation }     from './calendar.aggregation.js';
export { CalendarInsightsService } from './calendar.insights.js';
export { CalendarQuery }           from './calendar.query.js';
export { CalendarMutation }        from './calendar.mutation.js';

// ─── Utils (exported so cron jobs / other modules can reuse date helpers) ─────
export {
  normalizeDate,
  endOfDay,
  generateDateRange,
  getWorkDayNumbers,
  countWorkDays,
  countConsecutiveDays,
  isReviewDay,
  getWeekStart,
} from './calendar.utils.js';

// ─── Router ───────────────────────────────────────────────────────────────────
export { default as calendarRouter } from './calendar.routes.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  CalendarDayAggregate,
  BurnoutSignal,
  GoalCheckpoint,
  SystemCalendarEvent,
  CalendarFilters,
  TimeAllocation,
  CalendarInsights,
  CreateGoalCheckpointInput,
  RiskLevel,
} from './calendar.types.js';