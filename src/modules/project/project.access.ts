/**
 * project.access.ts
 * Responsibility: Authorization checks for the Project domain.
 *
 * Performance fix — isUserProjectAdmin:
 *  The original fired up to 2 DB queries per call:
 *   1. Check workspace.ownerId (already available on the project object)
 *   2. Query workspaceMember for ADMIN/OWNER role
 *
 *  Since `projectListInclude` fetches workspace.ownerId, the owner check
 *  is now a free in-memory comparison. The member query only fires if the
 *  user is NOT the owner — reducing DB calls for owners to zero.
 *
 * Type fix — `project: any` → `ProjectForPermission` typed interface.
 */

import { prisma } from '../../index.js';
import type { ProjectForPermission } from './project.types.js';
import { UnauthorizedError, NotFoundError } from './project.types.js';

export const ProjectAccess = {
  /**
   * Verifies the user is a member or owner of the workspace.
   * Returns the workspace record for reuse by the caller.
   */
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

  /**
   * Verifies the user is a workspace OWNER or ADMIN for the project's workspace.
   * Returns the project record for reuse by the caller.
   */
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

  /**
   * Verifies the user can access the project (any workspace member).
   * Returns the project record for reuse.
   */
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

  /**
   * Returns true if the user is a workspace OWNER or ADMIN for this project.
   *
   * Performance: owner check is a free in-memory comparison (no DB call).
   * The workspaceMember query only fires when the user is NOT the owner.
   *
   * @param project Must have workspace.id and workspace.ownerId populated.
   */
  async isProjectAdmin(userId: string, project: ProjectForPermission): Promise<boolean> {
    if (!project.workspace) return false;

    // Free check — no DB call needed
    if (project.workspace.ownerId === userId) return true;

    // Only query DB if the user isn't the owner
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