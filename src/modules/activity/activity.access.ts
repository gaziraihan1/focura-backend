/**
 * activity.access.ts
 * Responsibility: Authorization checks for the Activity domain.
 *
 * Every function answers one question: "Can user X do Y?"
 * Returns boolean, or throws with a descriptive error for guard assertions.
 *
 * Rules:
 *  - No activity records are read for display here.
 *  - No HTTP concepts (req/res) — this is pure business logic.
 *  - Controllers call these before delegating to query/mutation.
 */

import { prisma } from '../../index.js';

export const ActivityAccess = {
  /**
   * True if the user is the workspace owner or any member.
   */
  async canAccessWorkspace(userId: string, workspaceId: string): Promise<boolean> {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: userId },
          { members: { some: { userId } } },
        ],
      },
    });

    return !!workspace;
  },

  /**
   * True if the user created the task, is an assignee, or belongs
   * to the workspace that owns the task.
   */
  async canAccessTask(userId: string, taskId: string): Promise<boolean> {
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

    return !!task;
  },

  /**
   * True if the user is workspace OWNER or ADMIN.
   * Used for privileged mutations (deleting another user's activity).
   */
  async isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [
          { ownerId: userId },
          {
            members: {
              some: {
                userId,
                role: { in: ['OWNER', 'ADMIN'] },
              },
            },
          },
        ],
      },
    });

    return !!workspace;
  },

  /**
   * Throws if the caller cannot delete the given activity.
   *
   * Deletion rules:
   *  1. A user can always delete their own activity.
   *  2. A workspace OWNER/ADMIN can delete any activity in their workspace.
   */
  async assertCanDelete(callerId: string, activityId: string): Promise<void> {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }

    // Rule 1 — own record
    if (activity.userId === callerId) return;

    // Rule 2 — workspace admin
    if (activity.workspaceId) {
      const isAdmin = await this.isWorkspaceAdmin(callerId, activity.workspaceId);
      if (isAdmin) return;
    }

    throw new Error('You do not have permission to delete this activity');
  },
};