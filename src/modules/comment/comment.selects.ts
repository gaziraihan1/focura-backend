
export const userSelect = {
  id:    true,
  name:  true,
  image: true,
} as const;

export const commentFullInclude = {
  user: { select: userSelect },
  replies: {
    include: { user: { select: userSelect } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export const commentSimpleInclude = {
  user: { select: userSelect },
} as const;

export const taskForActivitySelect = {
  title: true,
  project: {
    select: { workspaceId: true },
  },
} as const;