/**
 * activity.routes.ts
 * Responsibility: Route definitions for the Activity domain.
 *
 * Rules:
 *  - Maps HTTP verbs + paths → controller handlers. Nothing else.
 *  - No middleware logic here — auth middleware is applied at the app level
 *    or passed in as a parameter if route-level auth is needed.
 *
 * ⚠️  Route order matters in Express — specific paths MUST come before params.
 *
 *  WRONG order (original bug):
 *    DELETE /:activityId    ← Express matches "clear" as an activityId param!
 *    DELETE /clear          ← This route is NEVER reached
 *
 *  CORRECT order (fixed here):
 *    DELETE /clear          ← Matched first because it's specific
 *    DELETE /:activityId    ← Only reached if the segment isn't "clear"
 */

import { Router } from 'express';
import {
  getActivities,
  getWorkspaceActivities,
  getTaskActivities,
  clearActivities,
  deleteActivity,
} from './activity.controller.js';

const router = Router();

// ─── GET ──────────────────────────────────────────────────────────────────────

/** All activities for the authenticated user (with optional filters) */
router.get('/', getActivities);

/** Activities scoped to a workspace */
router.get('/workspace/:workspaceId', getWorkspaceActivities);

/** Activities scoped to a task */
router.get('/task/:taskId', getTaskActivities);

// ─── DELETE ───────────────────────────────────────────────────────────────────

/**
 * Bulk-clear the user's own activities.
 * MUST be declared before /:activityId — "clear" would match as a param otherwise.
 */
router.delete('/clear', clearActivities);

/** Delete a specific activity by ID */
router.delete('/:activityId', deleteActivity);

export default router;