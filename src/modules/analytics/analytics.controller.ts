import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { AnalyticsQuery } from './analytics.query.js';

export class AnalyticsController {
  private static handleAnalyticsError(error: any, res: Response) {
    console.error('Analytics error:', error);

    if (error.message.includes('access') || error.message.includes('restricted')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data',
    });
  }

  static async getOverview(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;

      const [
        kpis,
        taskStatus,
        projectStatus,
        tasksByPriority,
        deadlineRisk,
      ] = await Promise.all([
        AnalyticsQuery.getExecutiveKPIs(workspaceId, req.user.id),
        AnalyticsQuery.getTaskStatusDistribution(workspaceId, req.user.id),
        AnalyticsQuery.getProjectStatusDistribution(workspaceId, req.user.id),
        AnalyticsQuery.getTasksByPriority(workspaceId, req.user.id),
        AnalyticsQuery.getDeadlineRiskAnalysis(workspaceId, req.user.id),
      ]);

      return res.json({
        success: true,
        data: {
          kpis,
          taskStatus,
          projectStatus,
          tasksByPriority,
          deadlineRisk,
        },
      });
    } catch (error: any) {
      return AnalyticsController.handleAnalyticsError(error, res);
    }
  }

  static async getTaskTrends(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string);

      const [completionTrend, overdueTrend] = await Promise.all([
        AnalyticsQuery.getTaskCompletionTrend(workspaceId, req.user.id, daysNum),
        AnalyticsQuery.getOverdueTrend(workspaceId, req.user.id, daysNum),
      ]);

      return res.json({
        success: true,
        data: {
          completionTrend,
          overdueTrend,
        },
      });
    } catch (error: any) {
      return AnalyticsController.handleAnalyticsError(error, res);
    }
  }

  static async getProjectHealth(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const metrics = await AnalyticsQuery.getProjectHealthMetrics(workspaceId, req.user.id);

      return res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      return AnalyticsController.handleAnalyticsError(error, res);
    }
  }

  static async getMemberContribution(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const contributions = await AnalyticsQuery.getMemberContribution(workspaceId, req.user.id);

      return res.json({
        success: true,
        data: contributions,
      });
    } catch (error: any) {
      return AnalyticsController.handleAnalyticsError(error, res);
    }
  }

  static async getTimeSummary(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const { days = '7' } = req.query;
      const daysNum = parseInt(days as string);

      const summary = await AnalyticsQuery.getTimeTrackingSummary(
        workspaceId,
        req.user.id,
        daysNum
      );

      return res.json({
        success: true,
        data: summary,
      });
    } catch (error: any) {
      return AnalyticsController.handleAnalyticsError(error, res);
    }
  }

  static async getActivityTrends(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string);

      const [volumeTrend, mostActiveDay] = await Promise.all([
        AnalyticsQuery.getActivityVolumeTrend(workspaceId, req.user.id, daysNum),
        AnalyticsQuery.getMostActiveDay(workspaceId, req.user.id),
      ]);

      return res.json({
        success: true,
        data: {
          volumeTrend,
          mostActiveDay,
        },
      });
    } catch (error: any) {
      return AnalyticsController.handleAnalyticsError(error, res);
    }
  }

  static async getWorkload(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const tasksPerMember = await AnalyticsQuery.getTasksPerMember(workspaceId, req.user.id);

      return res.json({
        success: true,
        data: tasksPerMember,
      });
    } catch (error: any) {
      return AnalyticsController.handleAnalyticsError(error, res);
    }
  }
}