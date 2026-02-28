import { Router } from 'express';
import { AnalyticsController } from './analytics.controller.js';

const router = Router();

router.get('/:workspaceId/overview', AnalyticsController.getOverview);

router.get('/:workspaceId/tasks/trends', AnalyticsController.getTaskTrends);

router.get('/:workspaceId/projects/health', AnalyticsController.getProjectHealth);

router.get('/:workspaceId/members/contribution', AnalyticsController.getMemberContribution);

router.get('/:workspaceId/time/summary', AnalyticsController.getTimeSummary);

router.get('/:workspaceId/activity/trends', AnalyticsController.getActivityTrends);

router.get('/:workspaceId/workload', AnalyticsController.getWorkload);

export default router;