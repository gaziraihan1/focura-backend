import { prisma } from "../../lib/prisma.js";

export const WorkspaceAccess = {
  async assertMember(workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    if (!member) throw new Error("Unauthorized");
    return member;
  },

  async assertAdmin(workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId, role: { in: ["OWNER", "ADMIN"] } },
    });
    if (!member) throw new Error("Unauthorized");
    return member;
  },

  async assertOwner(workspaceId: string, userId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId: userId },
    });
    if (!workspace) throw new Error("Unauthorized");
    return workspace;
  },
};
