/**
 * focusSession.selects.ts
 * Responsibility: Reusable Prisma include/select fragments for the FocusSession domain.
 *
 * Two shapes exist in the original:
 *  - taskSlimSelect  — id + title only (used in list/history/active queries)
 *  - taskFullInclude — full task (used in completeSession to get workspaceId)
 *
 * Centralising prevents the shapes from drifting apart across files.
 */

/** Slim task shape — id, title, description for display */
export const taskSlimSelect = {
  id:          true,
  title:       true,
  description: true,
} as const;

/** Minimal task shape — id and title only (used in session lists) */
export const taskIdTitleSelect = {
  id:    true,
  title: true,
} as const;

/** Full task include — needed when completing a session to get workspaceId */
export const taskWithWorkspaceInclude = {
  include: {
    // pull workspace id for calendar recalculation after completion
  },
} as const;

/** Session include for active/history queries — slim task only */
export const sessionWithSlimTask = {
  task: { select: taskSlimSelect },
} as const;

/** Session include for start — id and title only */
export const sessionWithIdTitle = {
  task: { select: taskIdTitleSelect },
} as const;