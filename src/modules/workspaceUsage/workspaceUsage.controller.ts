import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { WorkspaceUsageQuery } from './workspaceUsage.query.js';

export class WorkspaceUsageController {
  static async getWorkspaceUsage(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;

      const data = await WorkspaceUsageQuery.getWorkspaceUsage(
        workspaceId,
        req.user.id
      );

      return res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      console.error('Workspace usage error:', error);

      if (error.message.includes('access')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch workspace usage data',
      });
    }
  }
}