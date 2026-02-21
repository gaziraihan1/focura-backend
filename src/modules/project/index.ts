/**
 * project/index.ts
 * Responsibility: Public API surface of the Project module.
 *
 * Usage:
 *   import { ProjectQuery, ProjectMutation } from '../modules/project/index.js';
 *   import type { CreateProjectDto, ProjectStats } from '../modules/project/index.js';
 */

// ─── Services ─────────────────────────────────────────────────────────────────
export { ProjectQuery }    from './project.query.js';
export { ProjectMutation } from './project.mutation.js';
export { ProjectAccess }   from './project.access.js';

// ─── Pure utils (exported for use in tests or other modules) ──────────────────
export { calculateProjectStats } from './project.stats.js';

// ─── Error classes ────────────────────────────────────────────────────────────
export {
  ProjectError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from './project.types.js';

// ─── Router ───────────────────────────────────────────────────────────────────
export { default as projectRouter } from './project.routes.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  ProjectStatus,
  ProjectPriority,
  ProjectRole,
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMemberDto,
  UpdateProjectMemberRoleDto,
  ProjectStats,
  TopPerformer,
} from './project.types.js';