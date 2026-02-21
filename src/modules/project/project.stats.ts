/**
 * project.stats.ts
 * Responsibility: Pure stats calculation for the Project domain.
 *
 * `calculateProjectStats` was a private function in the service file typed
 * as `project: any`. Extracted here because:
 *  - It is pure — no DB calls, no side effects, same input → same output.
 *  - It can be unit-tested in complete isolation.
 *  - The `any` types are replaced with `ProjectForStats` typed interface.
 *
 * Performance fix — tasks array scanned once:
 *  The original filtered the tasks array 3 separate times:
 *    .filter(t => t.status === 'COMPLETED')  → scan 1
 *    .filter(t => t.dueDate && ...)           → scan 2
 *    .filter(t => t.status === 'COMPLETED')   → scan 3 (for topPerformer)
 *
 *  Now a single reduce pass classifies each task into all three buckets,
 *  then the performer aggregation runs on the already-filtered completed list.
 */

import type { ProjectForStats, ProjectStats } from './project.types.js';

export function calculateProjectStats(project: ProjectForStats): ProjectStats {
  const now = new Date();

  // Single pass — classify tasks into all buckets at once
  let completedTasks  = 0;
  let overdueTasks    = 0;
  const completedAssignees: Array<{
    id: string; name: string | null; email: string; image: string | null;
  }> = [];

  for (const task of project.tasks) {
    const isCompleted = task.status === 'COMPLETED';
    const isOverdue   = !!task.dueDate && new Date(task.dueDate) < now && !isCompleted;

    if (isCompleted) {
      completedTasks++;
      for (const a of task.assignees) {
        completedAssignees.push(a.user);
      }
    }

    if (isOverdue) overdueTasks++;
  }

  // Project age in days
  const startDate  = project.startDate ?? project.createdAt;
  const projectDays = Math.ceil(
    (now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
  );

  // Top performer — user with most completed task assignments
  const counts = completedAssignees.reduce<Record<string, number>>((acc, user) => {
    acc[user.id] = (acc[user.id] ?? 0) + 1;
    return acc;
  }, {});

  const topPerformerId = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  const topPerformer = topPerformerId
    ? (project.members.find((m) => m.userId === topPerformerId)?.user ?? null)
    : null;

  return {
    totalTasks:    project._count.tasks,
    completedTasks,
    overdueTasks,
    totalMembers:  project._count.members,
    projectDays,
    topPerformer,
  };
}