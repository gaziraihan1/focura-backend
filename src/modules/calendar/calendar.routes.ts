/**
 * calendar.routes.ts
 * Responsibility: Route definitions for the Calendar domain.
 *
 * Maps HTTP verbs + paths → controller handlers. Nothing else.
 */

import { Router } from 'express';
import {
  getCalendarAggregates,
  getCalendarInsights,
  getSystemEvents,
  getGoalCheckpoints,
  createGoalCheckpoint,
  recalculateAggregate,
  initializeUserSettings,
} from './calendar.controller.js';

const router = Router();

// ─── GET ──────────────────────────────────────────────────────────────────────
router.get('/aggregates',    getCalendarAggregates);
router.get('/insights',      getCalendarInsights);
router.get('/system-events', getSystemEvents);
router.get('/goals',         getGoalCheckpoints);

// ─── POST ─────────────────────────────────────────────────────────────────────
router.post('/goals',        createGoalCheckpoint);
router.post('/recalculate',  recalculateAggregate);
router.post('/initialize',   initializeUserSettings);

export default router;