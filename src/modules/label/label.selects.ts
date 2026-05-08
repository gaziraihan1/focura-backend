export const createdBySelect = {
  id:    true,
  name:  true,
  image: true,
} as const;

export const workspaceSelect = {
  id:   true,
  name: true,
  slug: true,
} as const;

const projectSelect = {
  id:   true,
  name: true,
  slug: true,
} as const;


export const labelListInclude = {
  workspace: { select: workspaceSelect },
  createdBy: { select: createdBySelect },
  _count:    { select: { tasks: true } },
} as const;


export const labelDetailInclude = {
  workspace: { select: workspaceSelect },
  createdBy: { select: createdBySelect },
  _count:    { select: { tasks: true } },
} as const;

export const labelTasksInclude = {
  task: {
    select: {
      id:       true,
      title:    true,
      status:   true,
      priority: true,
      workspace: { select: workspaceSelect },
      project:   { select: projectSelect },
    },
  },
} as const;


export const taskLabelInclude = {
  label: {
    include: {
      workspace: { select: workspaceSelect },
      createdBy: { select: createdBySelect },
      _count:    { select: { tasks: true } },
    },
  },
} as const;