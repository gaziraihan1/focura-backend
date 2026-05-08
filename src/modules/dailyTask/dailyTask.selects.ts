export const userSelect = {
  id:    true,
  name:  true,
  email: true,
  image: true,
} as const;

export const workspaceIdSelect = {
  id: true,
} as const;

export const workspaceNameSelect = {
  id:   true,
  name: true,
} as const;

export const taskFullInclude = {
  createdBy: { select: userSelect },
  assignees: {
    include: {
      user: { select: userSelect },
    },
  },
  labels:  { include: { label: true } },
  project: {
    select: {
      id:    true,
      name:  true,
      color: true,
      workspace: { select: workspaceNameSelect },
    },
  },
  _count: {
    select: {
      comments: true,
      subtasks: true,
      files:    true,
    },
  },
} as const;

export const taskWorkspaceInclude = {
  project: {
    select: {
      workspace: { select: workspaceIdSelect },
    },
  },
} as const;

export const taskStatsSelect = {
  id:          true,
  status:      true,
  completedAt: true,
} as const;