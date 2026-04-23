import { prisma } from "../../lib/prisma.js";
import {
  workspaceListInclude,
  workspaceDetailInclude,
} from "./workspace.selects.js";
import { WorkspaceAccess } from "./workspace.access.js";
import type { WorkspaceStats } from "./workspace.types.js";
import { projectWorkspaceListSelect } from "../project/project.selects.js";

export const WorkspaceQuery = {
  async getUserWorkspaces(userId: string) {
    return prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      include: workspaceListInclude,
      orderBy: { updatedAt: "desc" },
    });
  },

  async getBySlug(slug: string, userId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        slug,
        OR: [
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
    return WorkspaceQuery.computeStats(workspaceId);
  },

  async getOverview(slug: string, userId: string) {
    const isId = /^[a-z0-9]{20,}$/i.test(slug);

    const workspace = await prisma.workspace.findFirst({
      where: isId
        ? { id: slug,   OR: [{ isPublic: true }, { members: { some: { userId } } }] }
        : { slug,       OR: [{ isPublic: true }, { members: { some: { userId } } }] },
      include: workspaceDetailInclude,
    });

    if (!workspace) throw new Error("Workspace not found");
    if (workspace.deletedAt) throw new Error("Workspace suspended");

    const [stats, projects] = await Promise.all([
      WorkspaceQuery.computeStats(workspace.id),
      prisma.project.findMany({
        where:   { workspaceId: workspace.id },
        select:  projectWorkspaceListSelect,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return { workspace, stats, projects };
  },

  async computeStats(workspaceId: string): Promise<WorkspaceStats> {
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
      prisma.task.count({ where: { project: { workspaceId }, status: "COMPLETED" } }),
      prisma.task.count({
        where: {
          project: { workspaceId },
          dueDate: { lt: new Date() },
          status:  { notIn: ["COMPLETED", "CANCELLED"] },
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