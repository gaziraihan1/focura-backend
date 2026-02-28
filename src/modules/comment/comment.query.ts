
import { prisma } from '../../index.js';
import { commentFullInclude } from './comment.selects.js';
import { CommentAccess } from './comment.access.js';

export const CommentQuery = {
  async getComments(taskId: string, userId: string) {
    await CommentAccess.assertTaskAccess(taskId, userId);

    return prisma.comment.findMany({
      where:   { taskId },
      include: commentFullInclude,
      orderBy: { createdAt: 'asc' },
    });
  },
};