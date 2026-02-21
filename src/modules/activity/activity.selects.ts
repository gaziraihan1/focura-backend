/**
 * activity.selects.ts
 * Responsibility: Reusable Prisma `include` / `select` fragments.
 *
 * Why this file exists:
 *  Your original service copy-pasted the same include object 5 times.
 *  One field change meant 5 places to update — and they always drift apart.
 *  Centralising here means every query returns an identical shape.
 *
 * Rules:
 *  - No logic. No imports from this module.
 *  - Only Prisma-compatible plain objects.
 */

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

/**
 * Full context: user + workspace + task+project.
 * Used when the caller has no workspace context (e.g. user feed).
 */
export const activityFullInclude = {
  user:      { select: userSelect },
  workspace: { select: workspaceSelect },
  task:      { select: taskWithProjectSelect },
} as const;

/**
 * Slim context: user + task+project (workspace already known from scope).
 * Used for workspace-scoped queries.
 */
export const activitySlimInclude = {
  user: { select: userSelect },
  task: { select: taskWithProjectSelect },
} as const;

/**
 * Minimal context: user only.
 * Used for task-scoped queries where task is already known.
 */
export const activityUserOnlyInclude = {
  user: { select: userSelect },
} as const;