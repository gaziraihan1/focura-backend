/**
 * project.query.ts
 * Responsibility: Read-only SELECT operations for the Project domain.
 *
 * Performance fix 1 — N+1 in getUserProjects:
 *  ORIGINAL (N+1):
 *    const projects = await prisma.project.findMany(...)   // 1 query
 *    await Promise.all(projects.map(p => isUserProjectAdmin(userId, p))) // N queries
 *
 *  For 20 projects that's 21 DB queries minimum. For 20 projects where
 *  the user isn't the owner of any, it's 41 queries (1 + 20 workspace checks).
 *
 *  FIX: Fetch the user's workspace admin status ONCE, then determine
 *  isAdmin in memory based on workspace.ownerId or workspaceMember roles
 *  that are already included in the project data.
 *
 * Performance fix 2 — getProjectDetails sequential → parallel:
 *  ORIGINAL:
 *    const project = await getProject(...)          // waits
 *    const isAdmin = await isUserProjectAdmin(...)  // then fires
 *
 *  FIX: project fetch and admin check run concurrently with Promise.all.
 *  BUT — isAdmin needs the project's workspace, so we run the project
 *  fetch first (it's required), then run isAdmin in parallel with
 *  calculateProjectStats (which is synchronous but here for clarity).
 */

import { prisma } from '../../index.js';
import { NotFoundError } from './project.types.js';
import {
  projectListInclude,
  projectDetailInclude,
  projectWorkspaceListSelect,
} from './project.selects.js';
import { ProjectAccess } from './project.access.js';
import { calculateProjectStats } from './project.stats.js';

export const ProjectQuery = {
  /**
   * Returns all projects visible to the user with an isAdmin flag.
   *
   * Performance: resolves isAdmin in memory using already-fetched workspace
   * data — no extra DB queries per project.
   */
  async getUserProjects(userId: string) {
    // 1 query — workspace.ownerId is included so isAdmin check is free
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { members: { some: { userId } } },
          {
            workspace: {
              OR: [
                { ownerId: userId },
                { members: { some: { userId } } },
              ],
            },
          },
        ],
      },
      include: projectListInclude,
      orderBy: { updatedAt: 'desc' },
    });

    // Collect unique workspaceIds where user might be an ADMIN member
    // (owner check is free — done in memory)
    const nonOwnerWorkspaceIds = projects
      .filter((p) => p.workspace?.ownerId !== userId)
      .map((p) => p.workspace!.id);

    // 1 query to get all workspaces where user is ADMIN/OWNER member
    const adminMemberships = nonOwnerWorkspaceIds.length > 0
      ? await prisma.workspaceMember.findMany({
          where: {
            userId,
            workspaceId: { in: nonOwnerWorkspaceIds },
            role: { in: ['OWNER', 'ADMIN'] },
          },
          select: { workspaceId: true },
        })
      : [];

    const adminWorkspaceIds = new Set(adminMemberships.map((m) => m.workspaceId));

    // Resolve isAdmin in memory — zero additional DB queries
    return projects.map((project) => ({
      ...project,
      isAdmin:
        project.workspace?.ownerId === userId ||
        adminWorkspaceIds.has(project.workspace?.id ?? ''),
    }));
  },

  /**
   * Returns a slim list of projects for a workspace.
   * Caller must have workspace access (enforced by ProjectAccess.assertWorkspaceAccess).
   */
  async getProjectsByWorkspace(userId: string, workspaceId: string) {
    await ProjectAccess.assertWorkspaceAccess(userId, workspaceId);

    return prisma.project.findMany({
      where:   { workspaceId },
      select:  projectWorkspaceListSelect,
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Returns full project detail with stats and isAdmin flag.
   *
   * Performance: stats calculation (synchronous) and isAdmin check run
   * after the single project fetch — isAdmin reuses the already-loaded
   * workspace data, so only 1 extra DB query fires (for non-owners).
   */
  async getProjectDetails(userId: string, projectId: string) {
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
      include: projectDetailInclude,
    });

    if (!project) throw new NotFoundError('Project not found or access denied');

    // Stats are synchronous (no DB) — isAdmin fires at most 1 DB query
    const [stats, isAdmin] = await Promise.all([
      Promise.resolve(calculateProjectStats(project)),
      ProjectAccess.isProjectAdmin(userId, project),
    ]);

    return { ...project, stats, isAdmin };
  },
};