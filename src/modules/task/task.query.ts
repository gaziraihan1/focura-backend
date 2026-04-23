import { prisma } from '../../lib/prisma.js';
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
import { getTimeStatus } from './task.utils.js';

export const TaskQuery = {
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

    let where: Record<string, unknown>;

    if (filters.projectId) {
      where = TaskFilters.buildProjectFilter(filters);
    } else if (!filters.workspaceId) {
      where = TaskFilters.buildPersonalTasksFilter(filters);
    } else {
      where = await TaskFilters.buildWorkspaceTasksFilter(filters);
    }

    where = TaskFilters.applyAdditionalFilters(where, filters);

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
// task.query.ts

// Replace getTaskById to eliminate the double-query N+1
async getTaskById(taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [
        { createdById: userId },
        { assignees: { some: { userId } } },
        { project: { workspace: { members: { some: { userId } } } } },
        { workspace: { members: { some: { userId } } } },
      ],
    },
    include: taskDetailInclude,
  });

  if (!task) throw new Error('Task not found');
  return { ...task, timeTracking: getTimeStatus(task) };
},

// New: single round-trip for the detail page
async getTaskOverview(taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      OR: [
        { createdById: userId },
        { assignees: { some: { userId } } },
        { project: { workspace: { members: { some: { userId } } } } },
        { workspace: { members: { some: { userId } } } }, // direct workspace tasks
      ],
    },
    include: taskDetailInclude,
  });

  if (!task) throw new Error('Task not found');

  const [comments, attachments] = await Promise.all([
    prisma.comment.findMany({
      where:   { taskId, parentId: null },
      include: {
        user:    { select: { id: true, name: true, image: true } },
        replies: {
          include: {
            user: { select: { id: true, name: true, image: true } },
            mentions: {
              include: {
                mentionedUser: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        mentions: {
          include: {
            mentionedUser: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.file.findMany({
      where:   { taskId },
      include: {
        uploadedBy: { select: { id: true, name: true, image: true } },
      },
      orderBy: { uploadedAt: 'desc' },
    }),
  ]);

  return {
    task:        { ...task, timeTracking: getTimeStatus(task) },
    comments,
    attachments,
  };
},

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