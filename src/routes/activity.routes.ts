import express from 'express';
import {
  getActivities,
  getWorkspaceActivities,
  getTaskActivities,
  deleteActivity,
  clearActivities,
} from '../controllers/activity.controller.js';

const router = express.Router();

// Get all activities for current user
router.get('/', getActivities);

// Get activities by workspace
router.get('/workspace/:workspaceId', getWorkspaceActivities);

// Get activities by task
router.get('/task/:taskId', getTaskActivities);

// Delete a specific activity
router.delete('/:activityId', deleteActivity);

// Clear all activities (with optional filters)
router.delete('/clear/all', clearActivities);

export default router;