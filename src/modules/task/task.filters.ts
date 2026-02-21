/**
 * task.filters.ts
 * Responsibility: Prisma where-clause construction for the Task domain.
 *
 * This is the most complex part of the task service — the "3 filtering modes":
 *  1. Project-specific tasks (projectId filter)
 *  2. Personal tasks (created OR assigned to me, across all workspaces)
 *  3. Workspace tasks (all tasks in workspace projects where I'm a member OR workspace admin)
 *
 * The original had these as private methods scattered across the service class.
 * Extracted here because:
 *  - This is pure query construction logic — no DB writes, no side effects.
 *  - Each builder can be unit-tested in isolation with mock params.
 *  - The complexity is encapsulated away from the query execution.
 *
 * Performance note: buildWorkspaceTasksFilter queries workspaceMember for role.
 * If called multiple times for the same user/workspace (e.g., getTasks + getTaskStats
 * on the same page load), that's 2 identical role queries. Caller should cache
 * the role if calling both.
 */

import { prisma } from "../../index.js";
import type { TaskFilterParams } from "./task.types.js";

export const TaskFilters = {
  /**
   * SCENARIO 1: Filter tasks by specific project.
   * Access control is handled separately — this just builds the where clause.
   */
  buildProjectFilter(filters: TaskFilterParams): Record<string, unknown> {
    return { projectId: filters.projectId };
  },

  /**
   * SCENARIO 2: Personal tasks filter (no workspace).
   * Shows tasks created by me OR assigned to me across ALL workspaces.
   */
  buildPersonalTasksFilter(filters: TaskFilterParams): Record<string, unknown> {
    if (filters.type === "personal") {
      return {
        projectId: null,
        createdById: filters.userId,
      };
    }

    if (filters.type === "assigned") {
      return {
        assignees: { some: { userId: filters.userId } },
      };
    }

    if (filters.type === "created") {
      return { createdById: filters.userId };
    }

    // Default: all tasks related to me (created OR assigned)
    return {
      OR: [
        { createdById: filters.userId },
        { assignees: { some: { userId: filters.userId } } },
      ],
    };
  },

  /**
   * SCENARIO 3: Workspace tasks filter.
   * Shows tasks from projects in this workspace where:
   *  - User is workspace owner/admin (sees ALL workspace tasks), OR
   *  - User is a member of the project, OR
   *  - Task is created by user, OR
   *  - Task is assigned to user
   *
   * Performance: queries workspaceMember for role — caller should cache this
   * if calling multiple filter builders for the same workspace.
   */
  async buildWorkspaceTasksFilter(
    filters: TaskFilterParams,
  ): Promise<Record<string, unknown>> {
    if (!filters.workspaceId) {
      throw new Error("workspaceId is required for workspace filter");
    }

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: filters.workspaceId, userId: filters.userId },
      select: { role: true },
    });

    const isWorkspaceAdmin =
      workspaceMember?.role === "OWNER" || workspaceMember?.role === "ADMIN";

    const baseWorkspaceCondition = {
      project: { workspaceId: filters.workspaceId },
    };

    // Workspace owner/admin: show ALL workspace tasks
    if (isWorkspaceAdmin) {
      console.log(
        "👑 User is workspace OWNER/ADMIN - showing all workspace tasks",
      );

      if (filters.type === "assigned") {
        return {
          AND: [
            baseWorkspaceCondition,
            { assignees: { some: { userId: filters.userId } } },
          ],
        };
      }

      if (filters.type === "created") {
        return {
          AND: [baseWorkspaceCondition, { createdById: filters.userId }],
        };
      }

      // For 'all' or no type: show ALL workspace tasks
      return baseWorkspaceCondition;
    }

    // Regular member: show tasks where user is involved
    console.log("👤 User is workspace MEMBER - filtering by involvement");

    const userInvolvementConditions = {
      OR: [
        { createdById: filters.userId },
        { assignees: { some: { userId: filters.userId } } },
        {
          project: {
            AND: [
              { workspaceId: filters.workspaceId },
              { members: { some: { userId: filters.userId } } },
            ],
          },
        },
      ],
    };

    if (filters.type === "personal") {
      // Personal tasks don't belong to workspace
      return { id: "no-personal-tasks-in-workspace" };
    }

    if (filters.type === "assigned") {
      return {
        AND: [
          baseWorkspaceCondition,
          { assignees: { some: { userId: filters.userId } } },
        ],
      };
    }

    if (filters.type === "created") {
      return {
        AND: [baseWorkspaceCondition, { createdById: filters.userId }],
      };
    }

    // Default: tasks in workspace where user is involved
    return {
      AND: [baseWorkspaceCondition, userInvolvementConditions],
    };
  },

  /**
   * Applies additional filters (status, priority, labels, assignee) on top of
   * the base where clause from the 3 scenarios above.
   */
  applyAdditionalFilters(
    where: Record<string, unknown>,
    filters: TaskFilterParams,
  ): Record<string, unknown> {
    const result = { ...where };

    if (filters.status) result.status = filters.status;
    if (filters.priority) result.priority = filters.priority;

    if (filters.labelIds && filters.labelIds.length > 0) {
      result.labels = {
        some: { labelId: { in: filters.labelIds } },
      };
    }

    if (filters.assigneeId && filters.type !== "assigned") {
      result.assignees = {
        some: { userId: filters.assigneeId },
      };
    }

    return result;
  },

  /**
   * Applies search filter (title OR description contains query).
   * Merges with existing where clause while preserving AND/OR structure.
   */
  applySearchFilter(
    where: Record<string, unknown>,
    search: string,
  ): Record<string, unknown> {
    const searchConditions = {
      OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { description: { contains: search, mode: "insensitive" as const } },
      ],
    };

    // Merge search with existing where clause
    if (where.AND) {
      return {
        ...where,
        AND: [...(where.AND as any[]), searchConditions],
      };
    } else if (where.OR) {
      const result: Record<string, unknown> = {
        AND: [{ OR: where.OR }, searchConditions],
      };
      if (where.project) result.project = where.project;
      if (where.projectId) result.projectId = where.projectId;
      if (where.createdById) result.createdById = where.createdById;
      if (where.assignees) result.assignees = where.assignees;
      return result;
    } else {
      return {
        ...where,
        ...searchConditions,
      };
    }
  },

  /**
   * Builds the Prisma orderBy clause from sort params.
   */
  buildOrderBy(
    sortBy: "dueDate" | "priority" | "status" | "createdAt" | "title",
    sortOrder: "asc" | "desc",
  ): any[] {
    const order: "asc" | "desc" = sortOrder === "asc" ? "asc" : "desc";

    switch (sortBy) {
      case "dueDate":
        return [
          { dueDate: { sort: order, nulls: "last" as const } },
          { createdAt: "desc" as const },
        ];
      case "priority":
        return [
          { priority: order },
          { dueDate: { sort: "asc" as const, nulls: "last" as const } },
        ];
      case "status":
        return [{ status: order }, { priority: "desc" as const }];
      case "title":
        return [{ title: order }];
      case "createdAt":
      default:
        return [{ createdAt: order }];
    }
  },
};
