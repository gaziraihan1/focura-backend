
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

router.get('/aggregates',    getCalendarAggregates);
router.get('/insights',      getCalendarInsights);
router.get('/system-events', getSystemEvents);
router.get('/goals',         getGoalCheckpoints);

router.post('/goals',        createGoalCheckpoint);
router.post('/recalculate',  recalculateAggregate);
router.post('/initialize',   initializeUserSettings);

export default router;