import { Router } from 'express';
import { CalendarController } from '../controllers/calendar.controller.js';

const router = Router();


// Get calendar aggregates
router.get('/aggregates', CalendarController.getCalendarAggregates);

// Get calendar insights
router.get('/insights', CalendarController.getCalendarInsights);

// Get system events
router.get('/system-events', CalendarController.getSystemEvents);

// Get goal checkpoints
router.get('/goals', CalendarController.getGoalCheckpoints);

// Create goal checkpoint
router.post('/goals', CalendarController.createGoalCheckpoint);

// Recalculate aggregate
router.post('/recalculate', CalendarController.recalculateAggregate);

// Initialize user settings
router.post('/initialize', CalendarController.initializeUserSettings);

export default router;