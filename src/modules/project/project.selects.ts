/**
 * project.selects.ts
 * Responsibility: Reusable Prisma include/select fragments for the Project domain.
 *
 * The original had two factory functions `getProjectInclude()` and
 * `getProjectDetailsInclude()` — converted to plain const objects since
 * there are no dynamic parts. No call overhead, directly reusable.
 */

export const workspaceSelect = {
  id:      true,
  name:    true,
  ownerId: true,
  slug:    true,
} as const;

export const memberUserSelect = {
  id:    true,
  name:  true,
  email: true,
  image: true,
} as const;

export const taskAssigneeUserSelect = {
  id:    true,
  name:  true,
  email: true,
  image: true,
} as const;


/** Members list with user — shared between list and detail includes */
const membersInclude = {
  include: {
    user: { select: memberUserSelect },
  },
  orderBy: { joinedAt: 'asc' as const },
} as const;

/**
 * Standard include — used in list queries and mutations.
 * workspace + members + task count.
 */
export const projectListInclude = {
  workspace: { select: workspaceSelect },
  members:   membersInclude,
  _count:    { select: { tasks: true } },
} as const;

/**
 * Detail include — used in getProjectDetails.
 * Adds full task list with assignees + member count.
 */
export const projectDetailInclude = {
  workspace: { select: workspaceSelect },
  members:   membersInclude,
  tasks: {
    include: {
      assignees: {
        include: {
          user: { select: taskAssigneeUserSelect },
        },
      },
      _count: { select: { comments: true } },
    },
    orderBy: { createdAt: 'desc' as const },
  },
  _count: { select: { tasks: true, members: true } },
} as const;

/**
 * Workspace list select — used in getProjectsByWorkspace.
 * Intentionally slim: no task list, just counts.
 */
export const projectWorkspaceListSelect = {
  id:          true,
  name:        true,
  color:       true,
  description: true,
  status:      true,
  priority:    true,
  dueDate:     true,
  _count:      { select: { tasks: true, members: true } },
} as const;

/** Member include for addProjectMember / updateProjectMemberRole responses */
export const projectMemberInclude = {
  user: { select: memberUserSelect },
} as const;