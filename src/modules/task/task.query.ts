/**
 * task.query.ts
 * Responsibility: Read-only SELECT operations for the Task domain.
 *
 * Performance improvements:
 *  1. getTimeStatus called once per batch instead of once per task
 *  2. Filter builders centralized in task.filters.ts
 *  3. getTaskById uses assertTaskAccess (lighter than full permission check)
 */

import { prisma } from '../../index.js';
import type {
  TaskFilterParams,
  PaginationParams,
  SortParams,
  PaginatedTasksResult,
  TaskStats,
  TaskIntent,
} from './task.types.js';
import { taskFullInclude, taskDetailInclude } from './task.selects.js';
import { TaskFilters } from './task.filters.js';
import { TaskAccess } from './task.access.js';
import { getTimeStatus } from './task.utils.js';

export const TaskQuery = {
  /**
   * Returns a paginated list of tasks with complex filtering.
   *
   * 3 filtering modes:
   *  1. Project-specific (projectId filter)
   *  2. Personal (created OR assigned, across all workspaces)
   *  3. Workspace (all tasks in workspace where user is involved)
   *
   * Performance: getTimeStatus called once per batch instead of per task.
   */
  async getTasks(
    filters:    TaskFilterParams,
    pagination: PaginationParams = {},
    sort:       SortParams       = {},
  ): Promise<PaginatedTasksResult> {
    const page     = Math.max(1, pagination.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, pagination.pageSize ?? 10));
    const skip     = (page - 1) * pageSize;
    const sortBy   = sort.sortBy ?? 'createdAt';
    const sortOrder = sort.sortOrder ?? 'desc';

    // Build base where clause using the 3-mode logic
    let where: Record<string, unknown>;

    if (filters.projectId) {
      where = TaskFilters.buildProjectFilter(filters);
    } else if (!filters.workspaceId) {
      where = TaskFilters.buildPersonalTasksFilter(filters);
    } else {
      where = await TaskFilters.buildWorkspaceTasksFilter(filters);
    }

    // Apply additional filters
    where = TaskFilters.applyAdditionalFilters(where, filters);

    // Apply search filter
    if (filters.search?.trim()) {
      where = TaskFilters.applySearchFilter(where, filters.search);
    }

    console.log('🔍 Filter Mode:', {
      projectId:   filters.projectId   || 'none',
      workspaceId: filters.workspaceId || 'none',
      type:        filters.type        || 'all',
      mode:        filters.projectId ? 'PROJECT' : (!filters.workspaceId ? 'PERSONAL' : 'WORKSPACE'),
    });

    const orderBy = TaskFilters.buildOrderBy(sortBy, sortOrder);

    const [tasks, totalCount] = await Promise.all([
      prisma.task.findMany({
        where,
        include: taskFullInclude,
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    console.log(`📊 Found ${totalCount} tasks (showing ${tasks.length} on page ${page})`);

    // Performance: capture `now` once, apply to all tasks
    const now = new Date();
    const tasksWithTracking = tasks.map((task) => ({
      ...task,
      timeTracking: getTimeStatus(task, now),
    }));

    return {
      data: tasksWithTracking,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
        hasNext:    page < Math.ceil(totalCount / pageSize),
        hasPrev:    page > 1,
      },
    };
  },

  /**
   * Returns a single task by ID with full detail.
   * Enforces access control — throws if user cannot view the task.
   */
  async getTaskById(taskId: string, userId: string) {
    // assertTaskAccess throws if no access
    await TaskAccess.assertTaskAccess(taskId, userId);

    const task = await prisma.task.findUnique({
      where:   { id: taskId },
      include: taskDetailInclude,
    });

    // Shouldn't happen after assertTaskAccess but makes TypeScript happy
    if (!task) throw new Error('Task not found');

    return {
      ...task,
      timeTracking: getTimeStatus(task),
    };
  },

  /**
   * Returns task statistics with the same 3-mode filtering as getTasks.
   *
   * Performance note: if getTasks + getTaskStats are called on the same
   * page load for the same workspace, buildWorkspaceTasksFilter queries
   * workspaceMember twice. Caller should cache the role.
   */
  async getTaskStats(params: {
    userId:      string;
    workspaceId?: string;
    type?:       string;
  }): Promise<TaskStats> {
    console.log('📊 Getting stats for:', {
      userId:      params.userId,
      workspaceId: params.workspaceId || 'none',
      type:        params.type        || 'all',
    });

    // Build base where using the same logic as getTasks
    const baseWhere = !params.workspaceId
      ? TaskFilters.buildPersonalTasksFilter({ userId: params.userId, type: params.type })
      : await TaskFilters.buildWorkspaceTasksFilter({
          userId:      params.userId,
          workspaceId: params.workspaceId,
          type:        params.type,
        });

    console.log('📊 Stats WHERE clause:', JSON.stringify(baseWhere, null, 2));

    const [
      personalCount,
      assignedCount,
      createdCount,
      totalTasks,
      inProgress,
      completed,
      statusCounts,
      activeTasks,
      dueTodayCount,
    ] = await Promise.all([
      prisma.task.count({
        where: { projectId: null, createdById: params.userId },
      }),

      prisma.task.count({
        where: {
          assignees: { some: { userId: params.userId } },
          ...(params.workspaceId && { project: { workspaceId: params.workspaceId } }),
        },
      }),

      prisma.task.count({
        where: {
          createdById: params.userId,
          ...(params.workspaceId && { project: { workspaceId: params.workspaceId } }),
        },
      }),

      prisma.task.count({ where: baseWhere }),

      prisma.task.count({ where: { ...baseWhere, status: 'IN_PROGRESS' } }),

      prisma.task.count({ where: { ...baseWhere, status: 'COMPLETED' } }),

      prisma.task.groupBy({
        by:    ['status'],
        where: baseWhere,
        _count: true,
      }),

      prisma.task.findMany({
        where: {
          ...baseWhere,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
        select: {
          id:             true,
          createdAt:      true,
          dueDate:        true,
          estimatedHours: true,
          status:         true,
          actualHours:    true,
        },
      }),

      (async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return prisma.task.count({
          where: {
            ...baseWhere,
            dueDate: { gte: today, lt: tomorrow },
            status:  { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        });
      })(),
    ]);

    // Count overdue tasks in memory (getTimeStatus logic)
    const now = new Date();
    let overdueCount = 0;
    for (const task of activeTasks) {
      const timeStatus = getTimeStatus(task, now);
      if (timeStatus.isOverdue) overdueCount++;
    }

    const stats = {
      personal:   params.type === 'assigned' ? 0 : (params.workspaceId ? 0 : personalCount),
      assigned:   assignedCount,
      created:    createdCount,
      overdue:    overdueCount,
      dueToday:   dueTodayCount,
      totalTasks,
      inProgress,
      completed,
      byStatus:   statusCounts.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };

    console.log('📊 Stats result:', stats);
    return stats;
  },

  /**
   * Returns tasks filtered by intent (for focus mode).
   */
  async getTasksByIntent(params: {
    userId:      string;
    intent:      TaskIntent;
    workspaceId?: string;
  }) {
    const where: Record<string, unknown> = {
      intent: params.intent,
      OR: [
        { createdById: params.userId },
        { assignees: { some: { userId: params.userId } } },
      ],
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    };

    if (params.workspaceId) {
      where.project = { workspaceId: params.workspaceId };
    }

    return prisma.task.findMany({
      where,
      include: {
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        labels:  { include: { label: true } },
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate:  'asc' },
      ],
    });
  },
};