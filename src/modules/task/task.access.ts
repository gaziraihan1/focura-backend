/**
 * task.access.ts
 * Responsibility: Authorization checks for the Task domain.
 *
 * Performance fix — checkEditPermission:
 *  The original fetched the task with full detail (comments, subtasks, files).
 *  Only project + workspace member roles are needed for the permission check.
 *  New version uses taskPermissionInclude — ~10× lighter query.
 */

import { prisma } from '../../index.js';
import type { EditPermissionResult } from './task.types.js';
import { taskPermissionInclude } from './task.selects.js';

export const TaskAccess = {
  /**
   * Checks if a user can edit a task.
   *
   * Rules:
   *  - Personal task (no project): only the creator can edit
   *  - Project task: creator OR project MANAGER OR workspace OWNER/ADMIN can edit
   *
   * Performance: uses taskPermissionInclude instead of full task detail.
   * Returns the task so callers can reuse it (avoids double fetch).
   */
  async checkEditPermission(
    taskId: string,
    userId: string,
  ): Promise<EditPermissionResult & { task?: any }> {
    const task = await prisma.task.findFirst({
      where: { id: taskId },
      include: taskPermissionInclude,
    });

    if (!task) {
      return { canEdit: false, reason: 'Task not found' };
    }

    const isOwner       = task.createdById === userId;
    const isPersonalTask = !task.projectId;

    // Personal task: only owner can edit
    if (isPersonalTask) {
      if (!isOwner) {
        return { canEdit: false, reason: 'Only the task owner can edit personal tasks' };
      }
      return { canEdit: true, task };
    }

    // Project task: check roles
    const projectMember = task.project?.members?.find((m) => m.userId === userId);
    const isProjectManager = projectMember?.role === 'MANAGER';

    const workspaceMember = task.project?.workspace?.members?.find((m) => m.userId === userId);
    const isWorkspaceAdmin = workspaceMember?.role === 'OWNER' || workspaceMember?.role === 'ADMIN';

    const canEdit = isOwner || isProjectManager || isWorkspaceAdmin;

    if (!canEdit) {
      return {
        canEdit: false,
        reason:  'Only task owner, project managers, or workspace admins can edit this task',
      };
    }

    return { canEdit: true, task };
  },

  /**
   * Verifies the user can access a task (read permission).
   * Used in getTaskById — throws if access denied.
   */
  async assertTaskAccess(taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { createdById: userId },
          { assignees: { some: { userId } } },
          {
            project: {
              workspace: {
                OR: [
                  { ownerId: userId },
                  { members: { some: { userId } } },
                ],
              },
            },
          },
        ],
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    return task;
  },

  /**
   * Verifies the user can delete a task.
   * Only creator OR workspace OWNER/ADMIN can delete.
   */
  async assertDeletePermission(taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { createdById: userId },
          {
            project: {
              workspace: {
                members: {
                  some: {
                    userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                  },
                },
              },
            },
          },
        ],
      },
    });

    if (!task) {
      throw new Error('You do not have permission to delete this task');
    }

    return task;
  },
};