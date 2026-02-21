/**
 * task.selects.ts
 * Responsibility: Reusable Prisma include/select fragments for the Task domain.
 *
 * Three distinct shapes:
 *  - taskFullInclude:       used in list queries and detail view (includes counts)
 *  - taskDetailInclude:     used in getTaskById (adds comments, subtasks, files)
 *  - taskPermissionInclude: used in checkEditPermission (minimal — just project/workspace roles)
 *
 * The full include appears 6 times in the original service — one place to maintain now.
 */

export const createdBySelect = {
  id:    true,
  name:  true,
  email: true,
  image: true,
} as const;

export const assigneeUserSelect = {
  id:    true,
  name:  true,
  email: true,
  image: true,
} as const;

export const workspaceSelect = {
  id:   true,
  name: true,
} as const;

export const projectSlimSelect = {
  id:    true,
  name:  true,
  color: true,
  workspace: { select: workspaceSelect },
} as const;

export const projectWithWorkspaceIdSelect = {
  id:          true,
  name:        true,
  color:       true,
  workspaceId: true,
  workspace:   { select: { id: true, name: true, slug: true } },
} as const;

/**
 * Full task include — used in list queries (getTasks, updateTask response).
 * Includes assignees, labels, project, counts — but NOT comments/subtasks/files.
 */
export const taskFullInclude = {
  createdBy: { select: createdBySelect },
  assignees: {
    include: {
      user: { select: assigneeUserSelect },
    },
  },
  labels: { include: { label: true } },
  project: { select: projectWithWorkspaceIdSelect },
  _count: {
    select: {
      comments: true,
      subtasks: true,
      files:    true,
    },
  },
} as const;

/**
 * Detail task include — used in getTaskById.
 * Adds comments, subtasks, and files on top of the full include.
 */
export const taskDetailInclude = {
  createdBy: { select: createdBySelect },
  assignees: {
    include: {
      user: { select: assigneeUserSelect },
    },
  },
  labels: { include: { label: true } },
  project: { select: projectWithWorkspaceIdSelect },
  comments: {
    include: {
      user: { select: createdBySelect },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  subtasks: {
    include: {
      assignees: {
        include: {
          user: { select: { id: true, name: true, image: true } },
        },
      },
    },
  },
  files: {
    include: {
      uploadedBy: { select: { id: true, name: true, image: true } },
    },
  },
} as const;

/**
 * Permission-check include — used in checkEditPermission.
 * Only fetches project + workspace member roles — no task content, no counts.
 *
 * Performance: the original used taskDetailInclude for permission checks,
 * which pulled comments, subtasks, files unnecessarily. This is ~10× lighter.
 */
export const taskPermissionInclude = {
  project: {
    include: {
      workspace: {
        include: {
          members: {
            // The caller will filter by userId after the fetch
            select: { role: true, userId: true },
          },
        },
      },
      members: {
        // The caller will filter by userId after the fetch
        select: { role: true, userId: true },
      },
    },
  },
} as const;

/**
 * Minimal task select — used in updateTask to get old dueDate for calendar recalc.
 * Only workspaceId + dueDate.
 */
export const taskMinimalSelect = {
  id:          true,
  workspaceId: true,
  dueDate:     true,
} as const;

/**
 * Task with assignees — used in updateTaskStatus and deleteTask for cache invalidation.
 */
export const taskWithAssigneesInclude = {
  project: {
    select: { workspaceId: true },
  },
  assignees: {
    select: { userId: true },
  },
} as const;