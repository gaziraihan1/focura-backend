/**
 * comment.mutation.ts
 * Responsibility: Write operations for the Comment domain.
 *
 * Each mutation accepts an optional callback for activity logging.
 * The controller provides the callback, this module never imports ActivityService.
 */

import { prisma } from '../../index.js';
import type { CreateCommentInput, UpdateCommentInput } from './comment.types.js';
import { commentSimpleInclude } from './comment.selects.js';
import { CommentAccess } from './comment.access.js';

type OnCommentMutated = (data: {
  commentId:   string;
  taskId:      string;
  taskTitle:   string;
  workspaceId: string;
  content?:    string;
  oldContent?: string;
  newContent?: string;
}) => Promise<void>;

export const CommentMutation = {
  /**
   * Creates a new comment on a task.
   */
  async createComment(
    input:     CreateCommentInput,
    onCreated?: OnCommentMutated,
  ) {
    // Verify user can access the task
    await CommentAccess.assertTaskAccess(input.taskId, input.userId);

    const comment = await prisma.comment.create({
      data: {
        content:  input.content,
        taskId:   input.taskId,
        userId:   input.userId,
        parentId: input.parentId ?? null,
      },
      include: commentSimpleInclude,
    });

    // Fire callback (activity logging)
    if (onCreated) {
      onCreated({
        commentId:   comment.id,
        taskId:      input.taskId,
        taskTitle:   '', // provided by controller
        workspaceId: '', // provided by controller
        content:     input.content,
      }).catch((err) => console.error('Post-comment-creation callback failed:', err));
    }

    return comment;
  },

  /**
   * Updates an existing comment.
   * Only the comment author can update.
   */
  async updateComment(
    commentId: string,
    taskId:    string,
    userId:    string,
    input:     UpdateCommentInput,
    onUpdated?: OnCommentMutated,
  ) {
    const comment = await CommentAccess.assertCommentOwnership(commentId, taskId, userId);

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data:  { content: input.content, edited: true },
      include: commentSimpleInclude,
    });

    if (onUpdated) {
      onUpdated({
        commentId,
        taskId,
        taskTitle:   '', // provided by controller
        workspaceId: '', // provided by controller
        oldContent:  comment.content,
        newContent:  input.content,
      }).catch((err) => console.error('Post-comment-update callback failed:', err));
    }

    return updated;
  },

  /**
   * Deletes a comment.
   * Only the comment author can delete.
   */
  async deleteComment(
    commentId: string,
    taskId:    string,
    userId:    string,
    onDeleted?: OnCommentMutated,
  ): Promise<void> {
    const comment = await CommentAccess.assertCommentOwnership(commentId, taskId, userId);

    await prisma.comment.delete({ where: { id: commentId } });

    if (onDeleted) {
      onDeleted({
        commentId,
        taskId,
        taskTitle:   '', // provided by controller
        workspaceId: '', // provided by controller
        content:     comment.content,
      }).catch((err) => console.error('Post-comment-deletion callback failed:', err));
    }
  },
};