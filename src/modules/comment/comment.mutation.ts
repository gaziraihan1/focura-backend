import { prisma } from '../../index.js';
import type { CreateCommentInput, UpdateCommentInput } from './comment.types.js';
import { commentSimpleInclude } from './comment.selects.js';
import { CommentAccess } from './comment.access.js';
import { extractMentionedUserIds } from './mention/mention.utils.js';

type OnCommentMutated = (data: {
  commentId:   string;
  taskId:      string;
  taskTitle:   string;
  workspaceId: string;
  content?:    string;
  oldContent?: string;
  newContent?: string;
  mentionedIds?: string[];
  parentId?:    string | null
}) => Promise<void>;

export const CommentMutation = {
  async createComment(
    input:     CreateCommentInput,
    onCreated?: OnCommentMutated,
  ) {
    await CommentAccess.assertTaskAccess(input.taskId, input.userId);

    if(input.parentId) {
      const parent = await prisma.comment.findUnique({
        where: {id: input.parentId},
        select: {taskId: true, parentId: true},
      });
      if(!parent || parent.taskId !== input.taskId) {
        throw new Error('BAD_REQUEST: Invalid parent comment');
      }
      if(parent.parentId) {
        input.parentId = parent.parentId;
      }
    };

    const mentionedIds = extractMentionedUserIds(input.content);

    const comment = await prisma.comment.create({
      data: {
        content:  input.content,
        taskId:   input.taskId,
        userId:   input.userId,
        parentId: input.parentId ?? null,
      },
      include: commentSimpleInclude,
    });

    if(mentionedIds.length > 0) {
      await prisma.commentMention.createMany({
        data: mentionedIds.map((mentionedUserId) => ({
          commentId: comment.id,
          mentionedUserId,
          mentionedByUserId: input.userId,
        })),
        skipDuplicates: true
      })
    }

    if (onCreated) {
      onCreated({
        commentId:   comment.id,
        taskId:      input.taskId,
        taskTitle:   '', // provided by controller
        workspaceId: '', // provided by controller
        content:     input.content,
        parentId:    input.parentId ?? null,
        mentionedIds,
      }).catch((err) => console.error('Post-comment-creation callback failed:', err));
    }

    return comment;
  },

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