/**
 * label.selects.ts
 * Responsibility: Reusable Prisma include/select fragments for the Label domain.
 *
 * The original had `getLabelInclude()` as a function called in 4 places.
 * Converted to plain const objects — no need for a function when there are
 * no dynamic parts. Also adds the detail include (with tasks list) that
 * getLabel() was building inline.
 */

export const createdBySelect = {
  id:    true,
  name:  true,
  image: true,
} as const;

export const workspaceSelect = {
  id:   true,
  name: true,
} as const;

/**
 * Standard label include — used in list queries and mutations.
 * Shows workspace, creator, and task count.
 */
export const labelListInclude = {
  workspace:  { select: workspaceSelect },
  createdBy:  { select: createdBySelect },
  _count:     { select: { tasks: true } },
} as const;

/**
 * Detail label include — used in getLabel (single record).
 * Adds the full task list on top of the standard shape.
 */
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

/**
 * TaskLabel include — returned after adding a label to a task.
 */
export const taskLabelInclude = {
  label: {
    include: {
      workspace:  { select: workspaceSelect },
      createdBy:  { select: createdBySelect },
      _count:     { select: { tasks: true } },
    },
  },
} as const;