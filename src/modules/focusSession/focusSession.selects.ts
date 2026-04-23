export const taskSlimSelect = {
  id:          true,
  title:       true,
  description: true,
} as const;

export const taskIdTitleSelect = {
  id:    true,
  title: true,
} as const;

export const taskWithWorkspaceInclude = {
  include: {
    // pull workspace id for calendar recalculation after completion
  },
} as const;

export const sessionWithSlimTask = {
  task: { select: taskSlimSelect },
} as const;

export const sessionWithIdTitle = {
  task: { select: taskIdTitleSelect },
} as const;