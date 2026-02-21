/**
 * comment.selects.ts
 * Responsibility: Reusable Prisma include/select fragments for the Comment domain.
 */

export const userSelect = {
  id:    true,
  name:  true,
  image: true,
} as const;

/**
 * Full comment include — used in list queries (getComments).
 * Includes replies with nested user info.
 */
export const commentFullInclude = {
  user: { select: userSelect },
  replies: {
    include: { user: { select: userSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

/**
 * Simple comment include — used after create/update.
 * No replies needed for single-comment responses.
 */
export const commentSimpleInclude = {
  user: { select: userSelect },
} as const;

/**
 * Task minimal select — used to get workspace for activity logging.
 * Only fetches title + workspaceId.
 */
export const taskForActivitySelect = {
  title: true,
  project: {
    select: { workspaceId: true },
  },
} as const;