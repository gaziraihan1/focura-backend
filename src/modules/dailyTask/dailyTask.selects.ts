/**
 * dailyTask.selects.ts
 * Responsibility: Reusable Prisma `include` / `select` fragments.
 *
 * Why this file exists:
 *  The full task include block was copy-pasted 3 times in the original service
 *  (getDailyTasks, addDailyTask update path, addDailyTask create path).
 *  One field change now updates all three automatically.
 */

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

/**
 * Full task shape returned in list/create/update responses.
 * Includes counts for comments, subtasks, and files.
 */
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

/**
 * Slim task shape used when writing activity logs.
 * Only fetches workspace id — nothing displayed to the user.
 */
export const taskWorkspaceInclude = {
  project: {
    select: {
      workspace: { select: workspaceIdSelect },
    },
  },
} as const;

/**
 * Minimal task shape used in stats queries.
 * Only status and completedAt matter for completion-rate calculations.
 */
export const taskStatsSelect = {
  id:          true,
  status:      true,
  completedAt: true,
} as const;