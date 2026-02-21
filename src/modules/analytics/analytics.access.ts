// analytics.access.ts
/**
 * Access control for analytics endpoints.
 * Analytics are restricted to workspace ADMIN and OWNER roles only.
 */

import { prisma } from '../../index.js';

export const AnalyticsAccess = {

  /**
   * Assert that user is ADMIN or OWNER of the workspace
   * This is the main access control for analytics endpoints
   */
  async assertWorkspaceAdminOrOwner(userId: string, workspaceId: string) {
    const member = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });

    if (!member) {
      throw new Error('You do not have access to this workspace');
    }

    if (member.role !== 'ADMIN' && member.role !== 'OWNER') {
      throw new Error('Analytics access is restricted to workspace admins and owners');
    }

    return member;
  },

  /**
   * Check if user has admin/owner access (without throwing)
   */
  async isWorkspaceAdminOrOwner(userId: string, workspaceId: string): Promise<boolean> {
    const member = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });

    return member?.role === 'ADMIN' || member?.role === 'OWNER';
  },

  /**
   * Get list of workspace IDs where user is admin or owner
   */
  async getUserAdminWorkspaces(userId: string): Promise<string[]> {
    const memberships = await prisma.workspaceMember.findMany({
      where: {
        userId,
        role: { in: ['ADMIN', 'OWNER'] },
      },
      select: { workspaceId: true },
    });

    return memberships
      .map(m => m.workspaceId)
      .filter((id): id is string => id !== null);
  },
};