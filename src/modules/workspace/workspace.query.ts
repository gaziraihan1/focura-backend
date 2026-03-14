import { prisma } from "../../index.js";
import {
  workspaceListInclude,
  workspaceDetailInclude,
} from "./workspace.selects.js";
import { WorkspaceAccess } from "./workspace.access.js";
import type { WorkspaceStats } from "./workspace.types.js";

export const WorkspaceQuery = {
  async getUserWorkspaces(userId: string) {
    return prisma.workspace.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      include: workspaceListInclude,
      orderBy: { updatedAt: "desc" },
    });
  },

  async getBySlug(slug: string, userId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        slug,
        OR: [
          { ownerId: userId },
          { isPublic: true },
          { members: { some: { userId } } },
        ],
      },
      include: workspaceDetailInclude,
    });
    if (!workspace) throw new Error("Workspace not found");
    return workspace;
  },

  async getById(id: string, userId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id,
        OR: [
          { ownerId: userId },
          { isPublic: true },
          { members: { some: { userId } } },
        ],
      },
      include: workspaceDetailInclude,
    });
    if (!workspace) throw new Error("Workspace not found");
    return workspace;
  },

  async getMembers(workspaceId: string, userId: string) {
    await WorkspaceAccess.assertMember(workspaceId, userId);
    return prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { joinedAt: "asc" },
    });
  },

  async getStats(workspaceId: string, userId: string): Promise<WorkspaceStats> {
    await WorkspaceAccess.assertMember(workspaceId, userId);
    const [
      totalProjects,
      totalTasks,
      totalMembers,
      completedTasks,
      overdueTasks,
    ] = await Promise.all([
      prisma.project.count({ where: { workspaceId } }),
      prisma.task.count({ where: { project: { workspaceId } } }),
      prisma.workspaceMember.count({ where: { workspaceId } }),
      prisma.task.count({
        where: { project: { workspaceId }, status: "COMPLETED" },
      }),
      prisma.task.count({
        where: {
          project: { workspaceId },
          dueDate: { lt: new Date() },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
      }),
    ]);
    return {
      totalProjects,
      totalTasks,
      totalMembers,
      completedTasks,
      overdueTasks,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
    };
  },

  async getInvitationByToken(token: string) {
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            logo: true,
            color: true,
          },
        },
      },
    });
    if (!invitation) throw new Error("Invitation not found");
    return invitation;
  },
};
