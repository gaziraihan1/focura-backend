// services/task.service.refactored.ts
import { prisma } from "../index.js";
import { notifyUser, notifyTaskAssignees, notifyMentions } from "../utils/notification.helpers.js";
import { ActivityService } from "./activity.service.js";

/**
 * Calculate time-based status for a task
 */
const getTimeStatus = (task: any) => {
  const now = new Date();
  const createdAt = new Date(task.createdAt);
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  
  const hoursSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
  
  let hoursUntilDue = null;
  let isOverdue = false;
  let isDueToday = false;
  
  if (dueDate) {
    const msUntilDue = dueDate.getTime() - now.getTime();
    hoursUntilDue = Math.floor(msUntilDue / (1000 * 60 * 60));
    
    if (task.estimatedHours && task.actualHours) {
      isOverdue = task.actualHours > task.estimatedHours;
    } else if (task.estimatedHours) {
      isOverdue = hoursSinceCreation > task.estimatedHours;
    } else {
      isOverdue = now > dueDate;
    }
    
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    isDueToday = dueDate >= todayStart && dueDate <= todayEnd;
  }
  
  return {
    hoursSinceCreation,
    hoursUntilDue,
    isOverdue: task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && isOverdue,
    isDueToday,
    timeProgress: task.estimatedHours 
      ? Math.min(100, Math.round((hoursSinceCreation / task.estimatedHours) * 100))
      : null,
  };
};

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

interface SortParams {
  sortBy?: 'dueDate' | 'priority' | 'status' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

interface TaskFilterParams {
  userId: string;
  type?: string;
  workspaceId?: string;
  projectId?: string;
  status?: string;
  priority?: string;
  labelIds?: string[];
  assigneeId?: string;
  search?: string;
}

// Define the return type for getTasks
type GetTasksResult = {
  data: any[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};



export const TaskService = {


/**
 * COMPLETE TASK FILTERING SOLUTION
 * 
 * 3 Filtering Modes:
 * 1. Project-specific tasks (projectId filter)
 * 2. Personal tasks (created OR assigned to me, across all workspaces)
 * 3. Workspace tasks (all tasks in workspace projects where I'm a member OR I'm workspace owner/admin)
 */

async getTasks(
  filters: TaskFilterParams,
  pagination: PaginationParams = {},
  sort: SortParams = {}
): Promise<GetTasksResult> {
  const page = Math.max(1, pagination.page || 1);
  const pageSize = Math.min(100, Math.max(1, pagination.pageSize || 10));
  const skip = (page - 1) * pageSize;
  const sortBy = sort.sortBy || 'createdAt';
  const sortOrder = sort.sortOrder || 'desc';

  // Build base where clause
  let where: any = {};

  // SCENARIO 1: Project-specific tasks
  if (filters.projectId) {
    where = await this.buildProjectFilter(filters);
  }
  // SCENARIO 2: Personal tasks (no workspace filter)
  else if (!filters.workspaceId) {
    where = this.buildPersonalTasksFilter(filters);
  }
  // SCENARIO 3: Workspace tasks (with workspace filter)
  else {
    where = await this.buildWorkspaceTasksFilter(filters);
  }

  // Apply additional filters (status, priority, etc.)
  where = this.applyAdditionalFilters(where, filters);

  // Apply search filter
  if (filters.search && filters.search.trim()) {
    where = this.applySearchFilter(where, filters.search);
  }

  console.log('🔍 Filter Mode:', {
    projectId: filters.projectId || 'none',
    workspaceId: filters.workspaceId || 'none',
    type: filters.type || 'all',
    mode: filters.projectId ? 'PROJECT' : (!filters.workspaceId ? 'PERSONAL' : 'WORKSPACE')
  });
  console.log('🔍 WHERE clause:', JSON.stringify(where, null, 2));

  // Build orderBy clause
  const orderBy = this.buildOrderBy(sortBy, sortOrder);

  // Execute query with pagination
  const [tasks, totalCount] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        labels: {
          include: { label: true },
        },
        project: {
          select: { 
            id: true, 
            name: true, 
            color: true,
            workspace: {
              select: { id: true, name: true }
            }
          },
        },
        _count: {
          select: {
            comments: true,
            subtasks: true,
            files: true,
          },
        },
      },
      orderBy,
      skip,
      take: pageSize,
    }),
    prisma.task.count({ where }),
  ]);

  console.log(`📊 Found ${totalCount} tasks (showing ${tasks.length} on page ${page})`);

  // Add time tracking info
  const tasksWithTracking = tasks.map(task => ({
    ...task,
    timeTracking: getTimeStatus(task),
  }));

  const result: GetTasksResult = {
    data: tasksWithTracking,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      hasNext: page < Math.ceil(totalCount / pageSize),
      hasPrev: page > 1,
    },
  };

  return result;
},

/**
 * SCENARIO 1: Filter tasks by specific project
 */
async buildProjectFilter(filters: TaskFilterParams): Promise<any> {
  // Simply filter by project ID
  // Access control is handled by ensuring user has access to the project
  return {
    projectId: filters.projectId,
  };
},

/**
 * SCENARIO 2: Personal tasks filter (no workspace)
 * Shows tasks created by me OR assigned to me across ALL workspaces
 */
buildPersonalTasksFilter(filters: TaskFilterParams): any {
  if (filters.type === 'personal') {
    // Only personal tasks (no project)
    return {
      projectId: null,
      createdById: filters.userId,
    };
  }

  if (filters.type === 'assigned') {
    // Only tasks assigned to me
    return {
      assignees: {
        some: { userId: filters.userId },
      },
    };
  }

  if (filters.type === 'created') {
    // Only tasks created by me
    return {
      createdById: filters.userId,
    };
  }

  // Default: All tasks related to me (created OR assigned)
  return {
    OR: [
      { createdById: filters.userId },
      { assignees: { some: { userId: filters.userId } } },
    ],
  };
},

/**
 * SCENARIO 3: Workspace tasks filter
 * Shows tasks from projects in this workspace where:
 * - User is workspace owner/admin (sees ALL workspace tasks), OR
 * - User is a member of the project, OR
 * - Task is created by user, OR
 * - Task is assigned to user
 */
async buildWorkspaceTasksFilter(filters: TaskFilterParams): Promise<any> {
  if (!filters.workspaceId) {
    throw new Error('workspaceId is required for workspace filter');
  }

  // Check user's role in workspace
  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: filters.workspaceId,
      userId: filters.userId,
    },
    select: {
      role: true,
    },
  });

  const isWorkspaceAdmin = workspaceMember?.role === 'OWNER' || workspaceMember?.role === 'ADMIN';

  // Base condition: Tasks must be in projects within this workspace
  const baseWorkspaceCondition = {
    project: {
      workspaceId: filters.workspaceId,
    },
  };

  // If user is workspace owner/admin, show ALL tasks in workspace
  if (isWorkspaceAdmin) {
    console.log('👑 User is workspace OWNER/ADMIN - showing all workspace tasks');
    
    // Apply type filter for admins too
    if (filters.type === 'assigned') {
      return {
        AND: [
          baseWorkspaceCondition,
          {
            assignees: {
              some: { userId: filters.userId },
            },
          },
        ],
      };
    }

    if (filters.type === 'created') {
      return {
        AND: [
          baseWorkspaceCondition,
          { createdById: filters.userId },
        ],
      };
    }

    // For 'all' or no type: show ALL workspace tasks
    return baseWorkspaceCondition;
  }

  // Regular member: show tasks where user is involved
  console.log('👤 User is workspace MEMBER - filtering by involvement');

  const userInvolvementConditions = {
    OR: [
      { createdById: filters.userId },                          // I created it
      { assignees: { some: { userId: filters.userId } } },      // I'm assigned to it
      {
        // I'm a member of the project
        project: {
          AND: [
            { workspaceId: filters.workspaceId },
            { members: { some: { userId: filters.userId } } },
          ],
        },
      },
    ],
  };

  // Apply type filter for regular members
  if (filters.type === 'personal') {
    // Personal tasks don't belong to workspace
    return { id: 'no-personal-tasks-in-workspace' };
  }

  if (filters.type === 'assigned') {
    return {
      AND: [
        baseWorkspaceCondition,
        {
          assignees: {
            some: { userId: filters.userId },
          },
        },
      ],
    };
  }

  if (filters.type === 'created') {
    return {
      AND: [
        baseWorkspaceCondition,
        { createdById: filters.userId },
      ],
    };
  }

  // Default: tasks in workspace where user is involved
  return {
    AND: [
      baseWorkspaceCondition,
      userInvolvementConditions,
    ],
  };
},

/**
 * Apply additional filters (status, priority, labels, assignee)
 */
applyAdditionalFilters(where: any, filters: TaskFilterParams): any {
  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.priority) {
    where.priority = filters.priority;
  }

  if (filters.labelIds && filters.labelIds.length > 0) {
    where.labels = {
      some: {
        labelId: {
          in: filters.labelIds,
        },
      },
    };
  }

  if (filters.assigneeId && filters.type !== 'assigned') {
    where.assignees = {
      some: {
        userId: filters.assigneeId,
      },
    };
  }

  return where;
},

/**
 * Apply search filter
 */
applySearchFilter(where: any, search: string): any {
  const searchConditions = {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ],
  };

  // Merge search with existing where clause
  if (where.AND) {
    return {
      ...where,
      AND: [...where.AND, searchConditions],
    };
  } else if (where.OR) {
    return {
      AND: [
        { OR: where.OR },
        searchConditions,
      ],
      // Preserve other top-level conditions
      ...(where.project && { project: where.project }),
      ...(where.projectId && { projectId: where.projectId }),
      ...(where.createdById && { createdById: where.createdById }),
      ...(where.assignees && { assignees: where.assignees }),
    };
  } else {
    return {
      ...where,
      ...searchConditions,
    };
  }
},

/**
 * Apply workspace filter to restrict tasks to specific workspace
 */
applyWorkspaceFilter(where: any, filters: TaskFilterParams): any {
  // Personal tasks have no project, so can't belong to a workspace
  if (filters.type === 'personal') {
    return {
      id: 'no-personal-tasks-in-workspace', // Return no results
    };
  }

  // For workspace tasks, they MUST have a project in this workspace
  const workspaceCondition = {
    project: {
      workspaceId: filters.workspaceId,
    },
  };

  // If we have an OR clause (from type=all, assigned, or created), wrap it with AND
  if (where.OR) {
    return {
      AND: [
        workspaceCondition,
        { OR: where.OR },
      ],
    };
  }

  // Otherwise, merge the workspace condition
  return {
    ...where,
    ...workspaceCondition,
  };
},


buildTypeFilter(filters: TaskFilterParams): any {
  if (filters.type === 'personal') {
    return {
      projectId: null,
      createdById: filters.userId,
    };
  }

  if (filters.type === 'assigned') {
    return {
      assignees: {
        some: { userId: filters.userId },
      },
    };
  }

  if (filters.type === 'created') {
    return {
      createdById: filters.userId,
    };
  }

  // FIXED: "all" now ONLY shows tasks user created OR is assigned to
  // Does NOT include tasks from workspaces where user is just a member
  return {
    OR: [
      { createdById: filters.userId },           // Tasks I created
      { assignees: { some: { userId: filters.userId } } },  // Tasks assigned to me
    ],
  };
  
  
},


  buildOrderBy(sortBy: string, sortOrder: string): any {
    const order: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

    switch (sortBy) {
      case 'dueDate':
        return [
          { dueDate: { sort: order, nulls: 'last' as const } },
          { createdAt: 'desc' as const },
        ];
      case 'priority':
        return [
          { priority: order },
          { dueDate: { sort: 'asc' as const, nulls: 'last' as const } },
        ];
      case 'status':
        return [
          { status: order },
          { priority: 'desc' as const },
        ];
      case 'title':
        return [{ title: order }];
      case 'createdAt':
      default:
        return [{ createdAt: order }];
    }
  },

  /**
 * Get task statistics with proper workspace filtering
 * Matches the same 3-mode logic as getTasks
 */
async getTaskStats(params: {
  userId: string;
  workspaceId: string;
  type?: string;
} ) {
  console.log('📊 Getting stats for:', { 
    userId: params.userId, 
    workspaceId: params.workspaceId || 'none',
    type: params.type || 'all' 
  });

  let baseWhere: any = {};

  if (!params.workspaceId) {
    baseWhere = await this.buildPersonalStatsFilter(params);
  }
  else {
    baseWhere = await this.buildWorkspaceStatsFilter(params);
  }

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
      where: {
        projectId: null,
        createdById: params.userId,
      },
    }),
    
    prisma.task.count({
      where: {
        assignees: { some: { userId: params.userId } },
        ...(params.workspaceId && {
          project: { workspaceId: params.workspaceId },
        }),
      },
    }),
    
    prisma.task.count({
      where: {
        createdById: params.userId,
        ...(params.workspaceId && {
          project: { workspaceId: params.workspaceId },
        }),
      },
    }),
    
    prisma.task.count({ where: baseWhere }),
    
    prisma.task.count({
      where: { ...baseWhere, status: 'IN_PROGRESS' },
    }),
    
    prisma.task.count({
      where: { ...baseWhere, status: 'COMPLETED' },
    }),
    
    prisma.task.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: true,
    }),
    
    prisma.task.findMany({
      where: {
        ...baseWhere,
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      select: {
        id: true,
        createdAt: true,
        dueDate: true,
        estimatedHours: true,
        status: true,
        actualHours: true,
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
          dueDate: {
            gte: today,
            lt: tomorrow,
          },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      });
    })(),
  ]);

  let overdueCount = 0;
  activeTasks.forEach(task => {
    const timeStatus = getTimeStatus(task);
    if (timeStatus.isOverdue) {
      overdueCount++;
    }
  });

  const stats = {
    personal: params.type === 'assigned' ? 0 : (params.workspaceId ? 0 : personalCount),
    assigned: assignedCount,
    created: createdCount,
    overdue: overdueCount,
    dueToday: dueTodayCount,
    totalTasks,
    inProgress,
    completed,
    byStatus: statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>),
  };

  console.log('📊 Stats result:', stats);

  return stats;
},

async buildPersonalStatsFilter(params: {
  userId: string;
  type?: string;
}): Promise<any> {
  if (params.type === 'personal') {
    return {
      projectId: null,
      createdById: params.userId,
    };
  }

  if (params.type === 'assigned') {
    return {
      assignees: {
        some: { userId: params.userId },
      },
    };
  }

  if (params.type === 'created') {
    return {
      createdById: params.userId,
    };
  }

  return {
    OR: [
      { createdById: params.userId },
      { assignees: { some: { userId: params.userId } } },
    ],
  };
},

async buildWorkspaceStatsFilter(params: {
  userId: string;
  workspaceId: string;
  type?: string;
}): Promise<any> {
  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: params.workspaceId,
      userId: params.userId,
    },
    select: {
      role: true,
    },
  });

  const isWorkspaceAdmin = workspaceMember?.role === 'OWNER' || workspaceMember?.role === 'ADMIN';

  const baseWorkspaceCondition = {
    project: {
      workspaceId: params.workspaceId,
    },
  };

  if (isWorkspaceAdmin) {
    console.log('👑 Admin stats - counting all workspace tasks');
    
    if (params.type === 'assigned') {
      return {
        AND: [
          baseWorkspaceCondition,
          {
            assignees: {
              some: { userId: params.userId },
            },
          },
        ],
      };
    }

    if (params.type === 'created') {
      return {
        AND: [
          baseWorkspaceCondition,
          { createdById: params.userId },
        ],
      };
    }

    // For 'all' or no type: count ALL workspace tasks
    return baseWorkspaceCondition;
  }

  // Regular member: count tasks where user is involved
  console.log('👤 Member stats - counting involved tasks only');

  const userInvolvementConditions = {
    OR: [
      { createdById: params.userId },
      { assignees: { some: { userId: params.userId } } },
      {
        project: {
          AND: [
            { workspaceId: params.workspaceId },
            { members: { some: { userId: params.userId } } },
          ],
        },
      },
    ],
  };

  if (params.type === 'personal') {
    // No personal tasks in workspace
    return { id: 'no-personal-tasks-in-workspace' };
  }

  if (params.type === 'assigned') {
    return {
      AND: [
        baseWorkspaceCondition,
        {
          assignees: {
            some: { userId: params.userId },
          },
        },
      ],
    };
  }

  if (params.type === 'created') {
    return {
      AND: [
        baseWorkspaceCondition,
        { createdById: params.userId },
      ],
    };
  }

  // Default: tasks in workspace where user is involved
  return {
    AND: [
      baseWorkspaceCondition,
      userInvolvementConditions,
    ],
  };
},

  async createTask(data: {
    title: string;
    description?: string;
    projectId?: string;
    status?: string;
    priority?: string;
    dueDate?: Date;
    startDate?: Date;
    estimatedHours?: number;
    assigneeIds?: string[];
    labelIds?: string[];
    parentId?: string;
    focusRequired?: boolean;
    focusLevel?: number;
    energyType?: "LOW" | "MEDIUM" | "HIGH";
    distractionCost?: number;
    intent?: "EXECUTION" | "PLANNING" | "REVIEW" | "LEARNING" | "COMMUNICATION";
    createdById: string;
  }) {
    // Validate intent
    if (data.intent && ![
      "EXECUTION",
      "PLANNING",
      "REVIEW",
      "LEARNING",
      "COMMUNICATION",
    ].includes(data.intent)) {
      throw new Error("Invalid task intent. Must be one of: EXECUTION, PLANNING, REVIEW, LEARNING, COMMUNICATION");
    }

    // Validate title
    if (!data.title?.trim()) {
      throw new Error("Task title is required");
    }

    // Validate focus level
    if (data.focusLevel !== undefined && (data.focusLevel < 1 || data.focusLevel > 5)) {
      throw new Error("Focus level must be between 1 and 5");
    }

    // Validate energy type
    if (data.energyType && !["LOW", "MEDIUM", "HIGH"].includes(data.energyType)) {
      throw new Error("Invalid energy type. Must be one of: LOW, MEDIUM, HIGH");
    }

    // Validate distraction cost
    if (data.distractionCost !== undefined && data.distractionCost < 0) {
      throw new Error("Distraction cost cannot be negative");
    }

    // Validate assignee count
    if (data.assigneeIds && data.assigneeIds.length > 5) {
      throw new Error("Too many assignees reduce task focus");
    }

    // Resolve workspace and validate project access
    let finalWorkspaceId: string | null = null;

    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: data.projectId,
          workspace: {
            OR: [
              { ownerId: data.createdById },
              { members: { some: { userId: data.createdById } } },
            ],
          },
        },
      });

      if (!project) {
        throw new Error("You do not have access to this project");
      }

      finalWorkspaceId = project.workspaceId;
    }

    // Auto-compute priority based on due date
    let computedPriority = data.priority ?? "MEDIUM";
    if (!data.priority && data.dueDate) {
      const hoursLeft = (new Date(data.dueDate).getTime() - Date.now()) / 36e5;
      if (hoursLeft <= 24) computedPriority = "HIGH";
    }

    // Build task data
    const taskData: any = {
      title: data.title,
      description: data.description,
      status: data.status || "TODO",
      priority: computedPriority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      estimatedHours: data.estimatedHours,
      focusRequired: data.focusRequired ?? false,
      focusLevel: data.focusLevel,
      energyType: data.energyType,
      distractionCost: data.distractionCost,
      intent: data.intent,
      createdBy: {
        connect: { id: data.createdById },
      },
    };

    if (data.projectId) {
      taskData.project = { connect: { id: data.projectId } };
    }

    if (finalWorkspaceId) {
      taskData.workspace = { connect: { id: finalWorkspaceId } };
    }

    if (data.parentId) {
      taskData.parent = { connect: { id: data.parentId } };
    }

    if (data.assigneeIds?.length) {
      taskData.assignees = {
        create: data.assigneeIds.map((userId: string) => ({ userId })),
      };
    }

    if (data.labelIds?.length) {
      taskData.labels = {
        create: data.labelIds.map((labelId: string) => ({ labelId })),
      };
    }

    // Create task
    const task = await prisma.task.create({
      data: taskData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        labels: { include: { label: true } },
        project: {
          select: {
            id: true,
            name: true,
            color: true,
            workspaceId: true,
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: {
          select: {
            comments: true,
            subtasks: true,
            files: true,
          },
        },
      },
    });

    console.log(`✨ Task created: "${task.title}" (ID: ${task.id})`);

    // Invalidate caches using helper function

    // Create activity log (non-blocking)
    if (finalWorkspaceId) {
      prisma.activity.create({
        data: {
          action: "CREATED",
          entityType: "TASK",
          entityId: task.id,
          userId: data.createdById,
          workspaceId: finalWorkspaceId,
          taskId: task.id,
          metadata: {
            taskTitle: task.title,
            focusRequired: data.focusRequired,
            energyType: data.energyType,
            intent: data.intent,
          },
        },
      }).catch(err => console.error('Failed to log activity:', err));
    }

    // Send notifications (non-blocking)
    if (data.assigneeIds?.length) {
      prisma.user.findUnique({
        where: { id: data.createdById },
        select: { name: true },
      }).then(creator => {
        data.assigneeIds!.forEach(userId => {
          if (userId !== data.createdById) {
            notifyUser({
              userId,
              senderId: data.createdById,
              type: "TASK_ASSIGNED",
              title: "New Task Assigned",
              message: `${creator?.name || "Someone"} assigned you a task`,
              actionUrl: `/dashboard/tasks/${task.id}`,
            }).catch(() => {});
          }
        });
      });
    }

    return {
      ...task,
      timeTracking: getTimeStatus(task),
    };
  },


  /**
   * Get a single task by ID with caching
   */
  async getTaskById(params: {
    taskId: string;
    userId: string;
  }) {
    

    const task = await prisma.task.findFirst({
      where: {
        id: params.taskId,
        OR: [
          { createdById: params.userId },
          { assignees: { some: { userId: params.userId } } },
          {
            project: {
              workspace: {
                OR: [
                  { ownerId: params.userId },
                  { members: { some: { userId: params.userId } } },
                ],
              },
            },
          },
        ],
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        labels: {
          include: { label: true },
        },
        project: {
          select: { 
            id: true, 
            name: true, 
            color: true, 
            workspaceId: true,
            workspace: {
              select: { id: true, name: true, slug: true }
            }
          },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        subtasks: {
          include: {
            assignees: {
              include: {
                user: {
                  select: { id: true, name: true, image: true },
                },
              },
            },
          },
        },
        files: {
          include: {
            uploadedBy: {
              select: { id: true, name: true, image: true },
            },
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    const result = {
      ...task,
      timeTracking: getTimeStatus(task),
    };


    return result;
  },

  /**
   * Check if user has permission to edit task
   */
  async checkEditPermission(params: {
    taskId: string;
    userId: string;
  }): Promise<{ canEdit: boolean; reason?: string }> {
    const task = await prisma.task.findFirst({
      where: { id: params.taskId },
      include: { 
        project: {
          include: {
            workspace: {
              include: {
                members: {
                  where: { userId: params.userId },
                  select: { role: true },
                },
              },
            },
            members: {
              where: { userId: params.userId },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!task) {
      return { canEdit: false, reason: 'Task not found' };
    }

    const isOwner = task.createdById === params.userId;
    const isPersonalTask = !task.projectId;

    // Personal task: only owner can edit
    if (isPersonalTask) {
      if (!isOwner) {
        return { canEdit: false, reason: 'Only the task owner can edit personal tasks' };
      }
      return { canEdit: true };
    }

    // Project task: owner OR project manager OR workspace admin can edit
    const projectMember = task.project?.members?.[0];
    const isProjectManager = projectMember?.role === 'MANAGER';
    
    const workspaceMember = task.project?.workspace?.members?.[0];
    const isWorkspaceAdmin = 
      workspaceMember?.role === 'OWNER' || 
      workspaceMember?.role === 'ADMIN';

    const canEdit = isOwner || isProjectManager || isWorkspaceAdmin;

    if (!canEdit) {
      return { 
        canEdit: false, 
        reason: 'Only task owner, project managers, or workspace admins can edit this task' 
      };
    }

    return { canEdit: true };
  },

  /**
   * Update a task
   */
  async updateTask(params: {
    taskId: string;
    userId: string;
    data: {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      dueDate?: Date | null;
      startDate?: Date | null;
      estimatedHours?: number;
      assigneeIds?: string[];
      labelIds?: string[];
      focusRequired?: boolean;
      focusLevel?: number;
      energyType?: "LOW" | "MEDIUM" | "HIGH" | null;
      distractionCost?: number;
      intent?: "EXECUTION" | "PLANNING" | "REVIEW" | "LEARNING" | "COMMUNICATION";
    };
  }) {
    // Validate intent
    if (params.data.intent !== undefined && params.data.intent !== null && ![
      "EXECUTION",
      "PLANNING",
      "REVIEW",
      "LEARNING",
      "COMMUNICATION",
    ].includes(params.data.intent)) {
      throw new Error("Invalid task intent");
    }

    // Check permissions
    const permission = await this.checkEditPermission({
      taskId: params.taskId,
      userId: params.userId,
    });

    if (!permission.canEdit) {
      throw new Error(permission.reason || 'You do not have permission to edit this task');
    }

    // Fetch existing task
    const existingTask = await prisma.task.findUnique({
      where: { id: params.taskId },
      include: { 
        project: true,
        assignees: true,
      },
    });

    if (!existingTask) {
      throw new Error('Task not found');
    }

    // FIXED: Extract previousAssigneeIds BEFORE update
    const wasCompleted = params.data.status === 'COMPLETED' && existingTask.status !== 'COMPLETED';

    // Update task
    const updateData: any = {};
    
    if (params.data.title) updateData.title = params.data.title;
    if (params.data.description !== undefined) updateData.description = params.data.description;
    if (params.data.status) updateData.status = params.data.status as any;
    if (params.data.priority) updateData.priority = params.data.priority as any;
    if (params.data.dueDate !== undefined) {
      updateData.dueDate = params.data.dueDate ? new Date(params.data.dueDate) : null;
    }
    if (params.data.startDate !== undefined) {
      updateData.startDate = params.data.startDate ? new Date(params.data.startDate) : null;
    }
    if (params.data.estimatedHours !== undefined) updateData.estimatedHours = params.data.estimatedHours;
    if (wasCompleted) updateData.completedAt = new Date();
    if (params.data.focusRequired !== undefined) updateData.focusRequired = params.data.focusRequired;
    if (params.data.focusLevel !== undefined) updateData.focusLevel = params.data.focusLevel;
    if (params.data.energyType !== undefined) updateData.energyType = params.data.energyType as any;
    if (params.data.distractionCost !== undefined) updateData.distractionCost = params.data.distractionCost;
    if (params.data.intent !== undefined) updateData.intent = params.data.intent as any;

    const task = await prisma.task.update({
      where: { id: params.taskId },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        labels: {
          include: { label: true },
        },
        project: {
          select: { 
            id: true, 
            name: true, 
            color: true,
            workspace: {
              select: { id: true, name: true }
            }
          },
        },
      },
    });

    console.log(`✏️  Task updated: "${task.title}" (ID: ${task.id})`);

    // Handle assignee updates
    if (params.data.assigneeIds !== undefined) {
      const existingAssigneeIds = existingTask.assignees.map(a => a.userId);
      const newAssigneeIds = params.data.assigneeIds;
      const addedAssignees = newAssigneeIds.filter(
        uid => !existingAssigneeIds.includes(uid)
      );

      await prisma.taskAssignee.deleteMany({ where: { taskId: params.taskId } });
      if (params.data.assigneeIds.length > 0) {
        await prisma.taskAssignee.createMany({
          data: params.data.assigneeIds.map((userId: string) => ({
            taskId: params.taskId,
            userId,
          })),
        });
      }

      // Notify new assignees (non-blocking)
      if (addedAssignees.length > 0) {
        prisma.user.findUnique({
          where: { id: params.userId },
          select: { name: true },
        }).then(creator => {
          addedAssignees.forEach(userId => {
            if (userId !== params.userId) {
              notifyUser({
                userId,
                senderId: params.userId,
                type: 'TASK_ASSIGNED',
                title: 'Task Assigned',
                message: `${creator?.name || 'Someone'} assigned you to "${task.title}"`,
                actionUrl: `/dashboard/tasks/${params.taskId}`,
              }).catch(() => {});
            }
          });
        });
      }
    }

    // Handle label updates
    if (params.data.labelIds !== undefined) {
      await prisma.taskLabel.deleteMany({ where: { taskId: params.taskId } });
      if (params.data.labelIds.length > 0) {
        await prisma.taskLabel.createMany({
          data: params.data.labelIds.map((labelId: string) => ({
            taskId: params.taskId,
            labelId,
          })),
        });
      }
    }

    // Invalidate caches using helper function

    // Log status change activity (non-blocking)
    if (existingTask.project?.workspaceId && params.data.status && params.data.status !== existingTask.status) {
      ActivityService.createActivity({
        action: 'STATUS_CHANGED',
        entityType: 'TASK',
        entityId: params.taskId,
        userId: params.userId,
        workspaceId: existingTask.project.workspaceId,
        taskId: params.taskId,
        metadata: {
          taskTitle: existingTask.title,
          oldStatus: existingTask.status,
          newStatus: params.data.status,
        },
      }).catch(err => console.error('Failed to log activity:', err));
    }

    // Notify on completion (non-blocking)
    if (wasCompleted) {
      notifyTaskAssignees({
        taskId: params.taskId,
        senderId: params.userId,
        type: 'TASK_COMPLETED',
        title: 'Task Completed',
        message: `Task "${task.title}" was completed`,
        excludeUserId: params.userId,
      }).catch(() => {});
    }

    // Log update activity (non-blocking)
    if (existingTask.project?.workspaceId) {
      prisma.activity.create({
        data: {
          action: 'UPDATED',
          entityType: 'TASK',
          entityId: task.id,
          userId: params.userId,
          workspaceId: existingTask.project.workspaceId,
          taskId: task.id,
          metadata: {
            taskTitle: task.title,
            changes: params.data,
          },
        },
      }).catch(err => console.error('Failed to log activity:', err));
    }

    return {
      ...task,
      timeTracking: getTimeStatus(task),
    };
  },


  /**
   * Update task status only
   */
  async updateTaskStatus(params: {
    taskId: string;
    userId: string;
    status: string;
  }) {
    if (!params.status) {
      throw new Error("Status is required");
    }

    // Check permissions
    const permission = await this.checkEditPermission({
      taskId: params.taskId,
      userId: params.userId,
    });

    if (!permission.canEdit) {
      throw new Error(permission.reason || 'You do not have permission to change this task status');
    }

    // Fetch existing task (with assignees for cache invalidation)
    const existingTask = await prisma.task.findUnique({
      where: { id: params.taskId },
      include: { 
        project: true,
        assignees: true, // IMPROVEMENT: Include assignees
      },
    });

    if (!existingTask) {
      throw new Error('Task not found');
    }

    const wasCompleted = params.status === 'COMPLETED' && existingTask.status !== 'COMPLETED';
    const assigneeIds = existingTask.assignees.map(a => a.userId); // IMPROVEMENT: Get assignee IDs

    // Update task
    const updated = await prisma.task.update({
      where: { id: params.taskId },
      data: { 
        status: params.status as any,
        ...(wasCompleted && { completedAt: new Date() }),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
      },
    });

    console.log(`🔄 Task status updated: "${existingTask.title}" → ${params.status}`);

    // IMPROVEMENT: Use helper function for cache invalidation

    // Log status change activity (non-blocking)
    if (existingTask.project?.workspaceId && params.status !== existingTask.status) {
      ActivityService.createActivity({
        action: 'STATUS_CHANGED',
        entityType: 'TASK',
        entityId: params.taskId,
        userId: params.userId,
        workspaceId: existingTask.project.workspaceId,
        taskId: params.taskId,
        metadata: {
          taskTitle: existingTask.title,
          oldStatus: existingTask.status,
          newStatus: params.status,
        },
      }).catch(err => console.error('Failed to log activity:', err));
    }

    // Notify on completion (non-blocking)
    if (wasCompleted) {
      notifyTaskAssignees({
        taskId: params.taskId,
        senderId: params.userId,
        type: 'TASK_COMPLETED',
        title: 'Task Completed',
        message: `Task "${existingTask.title}" was completed`,
        excludeUserId: params.userId,
      }).catch(() => {});
    }

    return {
      ...updated,
      timeTracking: getTimeStatus(updated),
    };
  },

  /**
   * Delete a task
   */
  async deleteTask(params: {
    taskId: string;
    userId: string;
  }) {
    const task = await prisma.task.findFirst({
      where: {
        id: params.taskId,
        OR: [
          { createdById: params.userId },
          {
            project: {
              workspace: {
                members: {
                  some: {
                    userId: params.userId,
                    role: { in: ['OWNER', 'ADMIN'] },
                  },
                },
              },
            },
          },
        ],
      },
      include: { project: true, assignees: true },
    });

    if (!task) {
      throw new Error('You do not have permission to delete this task');
    }

    const assigneeIds = task.assignees.map(a => a.userId);

    // Delete task
    await prisma.task.delete({ where: { id: params.taskId } });

    console.log(`🗑️  Task deleted: "${task.title}" (ID: ${task.id})`);

    // Invalidate caches using helper function

    // Log deletion activity (non-blocking)
    if (task.project?.workspaceId) {
      ActivityService.createActivity({
        action: 'DELETED',
        entityType: 'TASK',
        entityId: task.id,
        userId: params.userId,
        workspaceId: task.project.workspaceId,
        metadata: {
          taskTitle: task.title,
          status: task.status,
          priority: task.priority,
          deletedAt: new Date().toISOString(),
        },
      }).catch(err => console.error('Failed to log activity:', err));
    }

    return { success: true };
  },

  /**
   * Add comment and notify assignees + mentioned users
   */
  async addComment(params: {
    taskId: string;
    userId: string;
    content: string;
  }) {
    const comment = await prisma.comment.create({
      data: {
        taskId: params.taskId,
        userId: params.userId,
        content: params.content,
      },
    });

    const [task, commenter] = await Promise.all([
      prisma.task.findUnique({ 
        where: { id: params.taskId },
        include: { project: true }
      }),
      prisma.user.findUnique({
        where: { id: params.userId },
        select: { name: true },
      }),
    ]);

    if (!task) return comment;

    // Invalidate task cache

    // Notify task assignees (non-blocking)
    notifyTaskAssignees({
      taskId: params.taskId,
      senderId: params.userId,
      type: "TASK_COMMENTED",
      title: "New Comment",
      message: `${commenter?.name || "Someone"} commented on "${task.title}"`,
      excludeUserId: params.userId,
    }).catch(() => {});

    // Handle mentions (non-blocking)
    if (task.projectId && task.project?.workspaceId) {
      notifyMentions({
        text: params.content,
        workspaceId: task.project.workspaceId,
        senderId: params.userId,
        senderName: commenter?.name || "Someone",
        context: `task "${task.title}"`,
        actionUrl: `/dashboard/tasks/${params.taskId}`,
      }).catch(() => {});
    }

    return comment;
  },

  /**
   * Get tasks by intent (for focus mode filtering)
   */
  async getTasksByIntent(params: {
    userId: string;
    intent: "EXECUTION" | "PLANNING" | "REVIEW" | "LEARNING" | "COMMUNICATION";
    workspaceId?: string;
  }) {
    const where: any = {
      intent: params.intent,
      OR: [
        { createdById: params.userId },
        { assignees: { some: { userId: params.userId } } },
      ],
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    };

    if (params.workspaceId) {
      where.project = {
        workspaceId: params.workspaceId,
      };
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        labels: {
          include: { label: true },
        },
        project: {
          select: { id: true, name: true, color: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });

    return tasks;
  },
};