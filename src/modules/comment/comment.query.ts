/**
 * comment.query.ts
 * Responsibility: Read-only SELECT operations for the Comment domain.
 */

import { prisma } from '../../index.js';
import { commentFullInclude } from './comment.selects.js';
import { CommentAccess } from './comment.access.js';

export const CommentQuery = {
  /**
   * Returns all comments for a task (including nested replies).
   * Enforces task access — throws if user cannot view the task.
   */
  async getComments(taskId: string, userId: string) {
    // Verify user can access this task
    await CommentAccess.assertTaskAccess(taskId, userId);

    return prisma.comment.findMany({
      where:   { taskId },
      include: commentFullInclude,
      orderBy: { createdAt: 'asc' },
    });
  },
};