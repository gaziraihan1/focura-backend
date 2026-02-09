// services/task.service.ts
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

export const TaskService = {
  /**
   * Get tasks with filters and permissions
   */
  async getTasks(params: {
    userId: string;
    type?: string;
    workspaceId?: string;
    projectId?: string;
    status?: string;
    priority?: string;
    labelIds?: string[];
    assigneeId?: string;
  }) {
    let where: any = {};

    // Apply type filter
    if (params.type === 'personal') {
      where = {
        projectId: null,
        createdById: params.userId,
      };
    } else if (params.type === 'assigned') {
      where = {
        assignees: {
          some: { userId: params.userId },
        },
      };
    } else if (params.type === 'created') {
      where = {
        createdById: params.userId,
      };
    } else {
      // All tasks user has access to
      where = {
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
      };
    }

    // Apply additional filters
    if (params.workspaceId) {
      where.project = { ...where.project, workspaceId: params.workspaceId };
    }

    if (params.projectId) {
      where.projectId = params.projectId;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.priority) {
      where.priority = params.priority;
    }

    if (params.labelIds && params.labelIds.length > 0) {
      where.labels = {
        some: {
          labelId: {
            in: params.labelIds,
          },
        },
      };
    }

    if (params.assigneeId && params.type !== 'assigned') {
      where.assignees = {
        some: {
          userId: params.assigneeId,
        },
      };
    }

    const tasks = await prisma.task.findMany({
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
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { dueDate: 'asc' },
      ],
    });

    // Add time tracking info
    return tasks.map(task => ({
      ...task,
      timeTracking: getTimeStatus(task),
    }));
  },

  /**
   * Get task statistics
   */
  async getTaskStats(params: {
    userId: string;
    workspaceId?: string;
    type?: string;
  }) {
    let baseWhere: any = {};

    // Apply type filter
    if (params.type === 'personal') {
      baseWhere = {
        projectId: null,
        createdById: params.userId,
      };
    } else if (params.type === 'assigned') {
      baseWhere = {
        assignees: {
          some: { userId: params.userId },
        },
      };
    } else if (params.type === 'created') {
      baseWhere = {
        createdById: params.userId,
      };
    } else {
      baseWhere = {
        OR: [
          { createdById: params.userId },
          { assignees: { some: { userId: params.userId } } },
        ],
      };
    }

    // Apply workspace filter
    if (params.workspaceId) {
      if (params.type === 'personal') {
        baseWhere = {
          ...baseWhere,
          workspaceId: null,
        };
      } else {
        baseWhere = {
          ...baseWhere,
          project: {
            workspaceId: params.workspaceId,
          },
        };
      }
    }

    // Get counts
    const [
      personalCount,
      assignedCount,
      createdCount,
      totalTasks,
      inProgress,
      completed,
      statusCounts,
      activeTasks,
    ] = await Promise.all([
      // Personal count (unfiltered)
      prisma.task.count({
        where: {
          projectId: null,
          createdById: params.userId,
        },
      }),
      
      // Assigned count
      prisma.task.count({
        where: {
          assignees: { some: { userId: params.userId } },
          ...(params.workspaceId && {
            project: { workspaceId: params.workspaceId },
          }),
        },
      }),
      
      // Created count
      prisma.task.count({
        where: {
          createdById: params.userId,
          ...(params.workspaceId && {
            project: { workspaceId: params.workspaceId },
          }),
        },
      }),
      
      // Total tasks
      prisma.task.count({ where: baseWhere }),
      
      // In progress
      prisma.task.count({
        where: { ...baseWhere, status: 'IN_PROGRESS' },
      }),
      
      // Completed
      prisma.task.count({
        where: { ...baseWhere, status: 'COMPLETED' },
      }),
      
      // Status counts
      prisma.task.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: true,
      }),
      
      // Active tasks for overdue calculation
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
    ]);

    // Calculate overdue count
    let overdueCount = 0;
    activeTasks.forEach(task => {
      const timeStatus = getTimeStatus(task);
      if (timeStatus.isOverdue) {
        overdueCount++;
      }
    });

    // Calculate due today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueTodayCount = await prisma.task.count({
      where: {
        ...baseWhere,
        dueDate: {
          gte: today,
          lt: tomorrow,
        },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });

    return {
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
  },

  /**
   * Create a new task
   */
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
            workspace: { select: { id: true, name: true } },
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

    // Create activity log
    if (finalWorkspaceId) {
      await prisma.activity.create({
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
      });
    }

    // Send notifications to assignees
    if (data.assigneeIds?.length) {
      const creator = await prisma.user.findUnique({
        where: { id: data.createdById },
        select: { name: true },
      });

      for (const userId of data.assigneeIds) {
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
      }
    }

    return {
      ...task,
      timeTracking: getTimeStatus(task),
    };
  },

  /**
   * Get a single task by ID
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
              select: { id: true, name: true }
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

    return {
      ...task,
      timeTracking: getTimeStatus(task),
    };
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

    // Log status change activity
    if (existingTask.project?.workspaceId && params.data.status && params.data.status !== existingTask.status) {
      try {
        await ActivityService.createActivity({
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
        });
      } catch (activityError) {
        console.error('Failed to log status change activity:', activityError);
      }
    }

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

      // Notify new assignees
      const creator = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { name: true },
      });

      for (const userId of addedAssignees) {
        if (userId !== params.userId) {
          try {
            await notifyUser({
              userId,
              senderId: params.userId,
              type: 'TASK_ASSIGNED',
              title: 'Task Assigned',
              message: `${creator?.name || 'Someone'} assigned you to "${task.title}"`,
              actionUrl: `/dashboard/tasks/${params.taskId}`,
            });
          } catch (notifError) {
            console.error('Failed to send notification:', notifError);
          }
        }
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

    // Notify on completion
    if (wasCompleted) {
      try {
        const completer = await prisma.user.findUnique({
          where: { id: params.userId },
          select: { name: true },
        });
        
        await notifyTaskAssignees({
          taskId: params.taskId,
          senderId: params.userId,
          type: 'TASK_COMPLETED',
          title: 'Task Completed',
          message: `${completer?.name || 'Someone'} completed "${task.title}"`,
          excludeUserId: params.userId,
        });
      } catch (notifError) {
        console.error('Failed to send completion notification:', notifError);
      }
    }

    // Log update activity
    if (existingTask.project?.workspaceId) {
      await prisma.activity.create({
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
      });
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

    // Fetch existing task
    const existingTask = await prisma.task.findUnique({
      where: { id: params.taskId },
      include: { project: true },
    });

    if (!existingTask) {
      throw new Error('Task not found');
    }

    const wasCompleted = params.status === 'COMPLETED' && existingTask.status !== 'COMPLETED';

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

    // Log status change activity
    if (existingTask.project?.workspaceId && params.status !== existingTask.status) {
      try {
        await ActivityService.createActivity({
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
        });
      } catch (activityError) {
        console.error('Failed to log status change activity:', activityError);
      }
    }

    // Notify on completion
    if (wasCompleted) {
      try {
        await notifyTaskAssignees({
          taskId: params.taskId,
          senderId: params.userId,
          type: 'TASK_COMPLETED',
          title: 'Task Completed',
          message: `${updated.createdBy.name || 'Someone'} completed "${existingTask.title}"`,
          excludeUserId: params.userId,
        });
      } catch (notifError) {
        console.error('Failed to send completion notification:', notifError);
      }
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
      include: { project: true },
    });

    if (!task) {
      throw new Error('You do not have permission to delete this task');
    }

    // Log deletion activity
    if (task.project?.workspaceId) {
      try {
        await ActivityService.createActivity({
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
        });
      } catch (activityError) {
        console.error('Failed to log deletion activity:', activityError);
      }
    }

    await prisma.task.delete({ where: { id: params.taskId } });

    return { success: true };
  },

  /**
   * Complete task and notify assignees
   */
  async completeTask(taskId: string, completedBy: string) {
    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: {
        assignees: true,
      },
    });

    const completer = await prisma.user.findUnique({
      where: { id: completedBy },
      select: { name: true },
    });

    // Notify other assignees
    await notifyTaskAssignees({
      taskId,
      senderId: completedBy,
      type: "TASK_COMPLETED",
      title: "Task Completed",
      message: `${completer?.name || "Someone"} completed "${task.title}"`,
      excludeUserId: completedBy,
    });

    return task;
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
      prisma.task.findUnique({ where: { id: params.taskId } }),
      prisma.user.findUnique({
        where: { id: params.userId },
        select: { name: true },
      }),
    ]);

    if (!task) return comment;

    // Notify task assignees (except commenter)
    await notifyTaskAssignees({
      taskId: params.taskId,
      senderId: params.userId,
      type: "TASK_COMMENTED",
      title: "New Comment",
      message: `${commenter?.name || "Someone"} commented on "${task.title}"`,
      excludeUserId: params.userId,
    });

    // Handle mentions
    if (task.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: task.projectId },
        select: { workspaceId: true },
      });

      if (project && project.workspaceId) {
        await notifyMentions({
          text: params.content,
          workspaceId: project.workspaceId,
          senderId: params.userId,
          senderName: commenter?.name || "Someone",
          context: `task "${task.title}"`,
          actionUrl: `/dashboard/tasks/${params.taskId}`,
        });
      }
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