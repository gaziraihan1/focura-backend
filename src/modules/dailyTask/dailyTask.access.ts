/**
 * dailyTask.access.ts
 * Responsibility: Authorization checks for the DailyTask domain.
 *
 * In the original, task access verification was embedded inside
 * `addDailyTask` — mixed with business rules (completed check, primary
 * conflict check) and DB writes. Extracting it here means:
 *  - Authorization is testable independently.
 *  - `addDailyTask` in the mutation file reads as a clean sequence of steps.
 *  - Other future mutations can reuse `assertTaskAccess` without duplication.
 */

import { prisma } from '../../index.js';
import { taskWorkspaceInclude } from './dailyTask.selects.js';

export const DailyTaskAccess = {
  /**
   * Returns the task if the user has access to it, null otherwise.
   * Access = created by, assigned to, or member of the workspace.
   *
   * Also fetches workspace id so callers can use it for activity logging
   * without making a second DB round-trip.
   */
  async findAccessibleTask(userId: string, taskId: string) {
    return prisma.task.findFirst({
      where: {
        id: taskId,
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
      include: taskWorkspaceInclude,
    });
  },

  /**
   * Throws if the user cannot access the task.
   * Returns the task (with workspace) so callers can use it immediately.
   */
  async assertTaskAccess(userId: string, taskId: string) {
    const task = await this.findAccessibleTask(userId, taskId);

    if (!task) {
      throw new Error('Task not found or you do not have access to this task');
    }

    return task;
  },
};