/**
 * dailyTask.routes.ts
 * Responsibility: Route definitions for the DailyTask domain.
 *
 * Route order is already correct in the original — specific paths
 * (/stats, /clear-expired) come before param paths (/:taskId).
 */

import { Router } from 'express';
import {
  getDailyTasks,
  addDailyTask,
  removeDailyTask,
  clearExpiredDailyTasks,
  getDailyTaskStats,
} from './dailyTask.controller.js';

const router = Router();

// ─── Specific paths first (before param routes) ───────────────────────────────
router.get('/stats',          getDailyTaskStats);
router.post('/clear-expired', clearExpiredDailyTasks);

// ─── Root and param routes ────────────────────────────────────────────────────
router.get('/',          getDailyTasks);
router.post('/',         addDailyTask);
router.delete('/:taskId', removeDailyTask);

export default router;