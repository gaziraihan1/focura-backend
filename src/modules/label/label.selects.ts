export const createdBySelect = {
  id:    true,
  name:  true,
  image: true,
} as const;

export const workspaceSelect = {
  id:   true,
  name: true,
} as const;

export const labelListInclude = {
  workspace:  { select: workspaceSelect },
  createdBy:  { select: createdBySelect },
  _count:     { select: { tasks: true } },
} as const;

export const labelDetailInclude = {
  workspace: { select: workspaceSelect },
  createdBy: { select: createdBySelect },
  tasks: {
    include: {
      task: {
        select: {
          id:       true,
          title:    true,
          status:   true,
          priority: true,
        },
      },
    },
  },
  _count: { select: { tasks: true } },
} as const;

export const taskLabelInclude = {
  label: {
    include: {
      workspace:  { select: workspaceSelect },
      createdBy:  { select: createdBySelect },
      _count:     { select: { tasks: true } },
    },
  },
} as const;