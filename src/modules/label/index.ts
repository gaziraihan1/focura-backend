/**
 * label/index.ts
 * Responsibility: Public API surface of the Label module.
 *
 * Usage:
 *   import { LabelQuery, LabelMutation } from '../modules/label/index.js';
 *   import type { CreateLabelDto, LabelFilters } from '../modules/label/index.js';
 */

// ─── Services ─────────────────────────────────────────────────────────────────
export { LabelQuery }    from './label.query.js';
export { LabelMutation } from './label.mutation.js';
export { LabelAccess }   from './label.access.js';

// ─── Error classes (exported so other modules can catch label errors) ─────────
export {
  LabelError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from './label.types.js';

// ─── Router ───────────────────────────────────────────────────────────────────
export { default as labelRouter } from './label.routes.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  CreateLabelDto,
  UpdateLabelDto,
  LabelFilters,
  PopularLabelsFilters,
} from './label.types.js';