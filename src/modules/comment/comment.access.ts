/**
 * comment.access.ts
 * Responsibility: Authorization checks for the Comment domain.
 *
 * The original only checked comment.userId === req.user.id but never
 * verified the user can access the task. This means:
 *  - User A posts comment on Task X
 *  - User B (no access to Task X) could still edit/delete User A's comment
 *    by guessing the commentId
 *
 * Fixed: assertCommentOwnership verifies both task access AND comment ownership.
 */

import { prisma } from '../../index.js';

export const CommentAccess = {
  /**
   * Verifies the user can access the task (same logic as TaskAccess.assertTaskAccess).
   * Returns the task for reuse by the caller.
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

    if (!task) throw new Error('Task not found or access denied');
    return task;
  },

  /**
   * Verifies the comment exists, belongs to the task, and the user is the author.
   * Returns the comment for reuse by the caller.
   */
  async assertCommentOwnership(commentId: string, taskId: string, userId: string) {
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, taskId },
    });

    if (!comment) throw new Error('Comment not found');

    if (comment.userId !== userId) {
      throw new Error('You cannot modify this comment');
    }

    return comment;
  },
};