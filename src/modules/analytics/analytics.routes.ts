// routes/analytics.routes.ts
import { Router } from 'express';
import { AnalyticsController } from './analytics.controller.js';

const router = Router();

/**
 * @route   GET /api/analytics/:workspaceId/overview
 * @desc    Get comprehensive analytics overview (KPIs + distributions)
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/overview', AnalyticsController.getOverview);

/**
 * @route   GET /api/analytics/:workspaceId/tasks/trends
 * @desc    Get task completion and overdue trends
 * @query   days - Number of days (default: 30)
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/tasks/trends', AnalyticsController.getTaskTrends);

/**
 * @route   GET /api/analytics/:workspaceId/projects/health
 * @desc    Get project health metrics
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/projects/health', AnalyticsController.getProjectHealth);

/**
 * @route   GET /api/analytics/:workspaceId/members/contribution
 * @desc    Get member contribution leaderboard
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/members/contribution', AnalyticsController.getMemberContribution);

/**
 * @route   GET /api/analytics/:workspaceId/time/summary
 * @desc    Get time tracking summary
 * @query   days - Number of days (default: 7)
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/time/summary', AnalyticsController.getTimeSummary);

/**
 * @route   GET /api/analytics/:workspaceId/activity/trends
 * @desc    Get activity volume trends and most active day
 * @query   days - Number of days (default: 30)
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/activity/trends', AnalyticsController.getActivityTrends);

/**
 * @route   GET /api/analytics/:workspaceId/workload
 * @desc    Get workload distribution per member
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/workload', AnalyticsController.getWorkload);

export default router;