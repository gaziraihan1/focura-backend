/**
 * attachment.access.ts
 * Responsibility: Authorization for attachment operations.
 */

import { prisma } from '../../index.js';

export const AttachmentAccess = {
  /**
   * Verifies user can add attachments to a task.
   * Rules:
   *  - Task must exist
   *  - User must have access to the task (creator, assignee, or workspace member)
   *  - Task must belong to a workspace/project (personal tasks cannot have attachments)
   */
  async assertCanAttach(taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        // Must have a project (no personal tasks)
        projectId: { not: null },
        // User must have access
        OR: [
          { createdById: userId },
          { assignees: { some: { userId } } },
          {
            project: {
              workspace: {
                members: { some: { userId } },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        project: {
          select: {
            workspaceId: true,
            workspace: {
              select: {
                id: true,
                plan: true,
                members: {
                  where: { userId },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found or you cannot attach files to this task');
    }

    if (!task.project?.workspaceId) {
      throw new Error('Personal tasks cannot have attachments');
    }

    return {
      workspaceId: task.project.workspaceId,
      workspacePlan: task.project.workspace?.plan ?? "FREE",
      userRole: task.project.workspace?.members[0]?.role,
    };
  },

  /**
   * Verifies user can delete an attachment.
   * Rules:
   *  - File uploader can delete
   *  - Workspace OWNER/ADMIN can delete
   */
  async assertCanDelete(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId },
      select: {
        id: true,
        name: true,
        uploadedById: true,
        workspaceId: true,
        workspace: {
          select: {
            members: {
              where: { userId },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!file) throw new Error('File not found');

    const isUploader = file.uploadedById === userId;
    const isAdmin = file.workspace?.members[0]?.role === 'OWNER' || file.workspace?.members[0]?.role === 'ADMIN';

    if (!isUploader && !isAdmin) {
      throw new Error('You do not have permission to delete this file');
    }

    return file;
  },

  /**
   * Verifies user can view attachment stats (workspace owner/admin only).
   */
  async assertCanViewStats(workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });

    if (!member) {
      throw new Error('Only workspace owners and admins can view attachment statistics');
    }
  },
};