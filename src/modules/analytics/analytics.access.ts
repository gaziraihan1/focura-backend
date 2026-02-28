
import { prisma } from '../../index.js';

export const AnalyticsAccess = {

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

  async isWorkspaceAdminOrOwner(userId: string, workspaceId: string): Promise<boolean> {
    const member = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
      select: { role: true },
    });

    return member?.role === 'ADMIN' || member?.role === 'OWNER';
  },

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