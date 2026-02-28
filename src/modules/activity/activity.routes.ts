
import { Router } from 'express';
import {
  getActivities,
  getWorkspaceActivities,
  getTaskActivities,
  clearActivities,
  deleteActivity,
} from './activity.controller.js';

const router = Router();

router.get('/', getActivities);

router.get('/workspace/:workspaceId', getWorkspaceActivities);

router.get('/task/:taskId', getTaskActivities);

router.delete('/clear', clearActivities);

router.delete('/:activityId', deleteActivity);

export default router;