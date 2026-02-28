
import { prisma } from '../../index.js';
import type { ProjectForPermission } from './project.types.js';
import { UnauthorizedError, NotFoundError } from './project.types.js';

export const ProjectAccess = {
  async assertWorkspaceAccess(userId: string, workspaceId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
    });

    if (!workspace) throw new UnauthorizedError('No access to this workspace');

    return workspace;
  },

  async assertProjectAdminAccess(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId, role: { in: ['ADMIN', 'OWNER'] } } } },
          ],
        },
      },
      include: { workspace: true },
    });

    if (!project) throw new UnauthorizedError('Only admins can perform this action');

    return project;
  },

  async assertProjectAccess(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId } } },
          ],
        },
      },
    });

    if (!project) throw new NotFoundError('Project not found or access denied');

    return project;
  },

  async isProjectAdmin(userId: string, project: ProjectForPermission): Promise<boolean> {
    if (!project.workspace) return false;

    if (project.workspace.ownerId === userId) return true;

    const adminMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: project.workspace.id,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    return !!adminMember;
  },
};