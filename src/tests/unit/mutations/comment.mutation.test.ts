import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommentMutation } from '../../../modules/comment/comment.mutation.js';

/* ─────────────────────────────────────────────
   PRISMA MOCK (FULL ISOLATION)
───────────────────────────────────────────── */
vi.mock('../../../lib/prisma.js', () => {
  return {
    prisma: {
      comment: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      commentMention: {
        createMany: vi.fn(),
      },
      $transaction: vi.fn((fn) => fn({
        comment: {
          create: vi.fn(),
        },
        commentMention: {
          createMany: vi.fn(),
        },
      })),
    },
  };
});

import { prisma } from '../../../lib/prisma.js';

/* ─────────────────────────────────────────────
   ACCESS MOCK
───────────────────────────────────────────── */
vi.mock('../../../modules/comment/comment.access.js', () => ({
  CommentAccess: {
    assertTaskAccess: vi.fn(),
    assertCommentOwnership: vi.fn(),
  },
}));

import { CommentAccess } from '../../../modules/comment/comment.access.js';

/* ─────────────────────────────────────────────
   MENTION UTILS MOCK
───────────────────────────────────────────── */
vi.mock('../../../modules/comment/mention/mention.utils.js', () => ({
  extractMentionedUserIds: vi.fn(() => ['user_2']),
}));

import { extractMentionedUserIds } from '../../../modules/comment/mention/mention.utils.js';

describe('CommentMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* ─────────────────────────────────────────────
     CREATE COMMENT
  ───────────────────────────────────────────── */
  it('creates comment with mentions inside transaction', async () => {
    (CommentAccess.assertTaskAccess as any).mockResolvedValue(true);

    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      return fn({
        comment: {
          create: vi.fn().mockResolvedValue({
            id: 'c1',
            content: 'hello @user',
          }),
        },
        commentMention: {
          createMany: vi.fn(),
        },
      });
    });

    const result = await CommentMutation.createComment({
      taskId: 't1',
      userId: 'u1',
      content: 'hello @user',
      parentId: null,
    } as any);

    expect(result).toBeDefined();
    expect(result.id).toBe('c1');
  });

  it('rejects invalid parent comment task mismatch', async () => {
    (CommentAccess.assertTaskAccess as any).mockResolvedValue(true);

    (prisma.comment.findUnique as any).mockResolvedValue({
      taskId: 'different_task',
      parentId: null,
    });

    await expect(
      CommentMutation.createComment({
        taskId: 't1',
        userId: 'u1',
        content: 'hello',
        parentId: 'p1',
      } as any),
    ).rejects.toThrow('BAD_REQUEST');
  });

  it('calls onCreated callback safely', async () => {
    (CommentAccess.assertTaskAccess as any).mockResolvedValue(true);

    (prisma.$transaction as any).mockImplementation(async (fn: any) => {
      return fn({
        comment: {
          create: vi.fn().mockResolvedValue({
            id: 'c1',
            content: 'hello',
          }),
        },
        commentMention: {
          createMany: vi.fn(),
        },
      });
    });

    const cb = vi.fn().mockResolvedValue(undefined);

    await CommentMutation.createComment(
      {
        taskId: 't1',
        userId: 'u1',
        content: 'hello',
        parentId: null,
      } as any,
      cb,
    );

    expect(cb).toHaveBeenCalled();
  });

  /* ─────────────────────────────────────────────
     UPDATE COMMENT
  ───────────────────────────────────────────── */
  it('updates comment successfully', async () => {
    (CommentAccess.assertCommentOwnership as any).mockResolvedValue({
      id: 'c1',
      content: 'old',
    });

    (prisma.comment.update as any).mockResolvedValue({
      id: 'c1',
      content: 'new',
    });

    const result = await CommentMutation.updateComment(
      'c1',
      't1',
      'u1',
      { content: 'new' } as any,
    );

    expect(result.content).toBe('new');
    expect(prisma.comment.update).toHaveBeenCalled();
  });

  it('calls onUpdated callback safely', async () => {
    (CommentAccess.assertCommentOwnership as any).mockResolvedValue({
      id: 'c1',
      content: 'old',
    });

    (prisma.comment.update as any).mockResolvedValue({
      id: 'c1',
      content: 'new',
    });

    const cb = vi.fn().mockResolvedValue(undefined);

    await CommentMutation.updateComment(
      'c1',
      't1',
      'u1',
      { content: 'new' } as any,
      cb,
    );

    expect(cb).toHaveBeenCalled();
  });

  /* ─────────────────────────────────────────────
     DELETE COMMENT
  ───────────────────────────────────────────── */
  it('deletes comment successfully', async () => {
    (CommentAccess.assertCommentOwnership as any).mockResolvedValue({
      id: 'c1',
      content: 'hello',
    });

    (prisma.comment.delete as any).mockResolvedValue({});

    await CommentMutation.deleteComment('c1', 't1', 'u1');

    expect(prisma.comment.delete).toHaveBeenCalledWith({
      where: { id: 'c1' },
    });
  });

  it('calls onDeleted callback safely', async () => {
    (CommentAccess.assertCommentOwnership as any).mockResolvedValue({
      id: 'c1',
      content: 'hello',
    });

    (prisma.comment.delete as any).mockResolvedValue({});

    const cb = vi.fn().mockResolvedValue(undefined);

    await CommentMutation.deleteComment('c1', 't1', 'u1', cb);

    expect(cb).toHaveBeenCalled();
  });
});