
export const userSelect = {
  id: true,
  name: true,
  email: true,
  image: true,
} as const;

export const workspaceSelect = {
  id: true,
  name: true,
} as const;

export const taskWithProjectSelect = {
  id: true,
  title: true,
  status: true,
  priority: true,
  project: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
} as const;

export const activityFullInclude = {
  user:      { select: userSelect },
  workspace: { select: workspaceSelect },
  task:      { select: taskWithProjectSelect },
} as const;

export const activitySlimInclude = {
  user: { select: userSelect },
  task: { select: taskWithProjectSelect },
} as const;

export const activityUserOnlyInclude = {
  user: { select: userSelect },
} as const;