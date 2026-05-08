import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { WorkspaceUsageQuery } from './workspaceUsage.query.js';
import { prisma } from '../../lib/prisma.js';
import { WorkspaceUsageAccess } from './workspaceUsage.access.js';

async function assertWorkspaceUsageAccess(
  workspaceId: string,
  userId: string
) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });

  if (!workspace) {
    throw new Error("Workspace not found");
  }

  if (workspace.plan === "FREE") {
    throw new Error("Upgrade workspace plan to access usage analytics");
  }

  await WorkspaceUsageAccess.assertWorkspaceMember(userId, workspaceId);
}

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

      await assertWorkspaceUsageAccess(workspaceId, req.user.id);

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

      if (error.message.includes('Upgrade workspace plan')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.toLowerCase().includes('access')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message === "Workspace not found") {
        return res.status(404).json({
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