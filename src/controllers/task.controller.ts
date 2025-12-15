import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../index.js';
import { notifyUser, notifyTaskAssignees } from '../utils/notification.helpers.js';

// Helper function to calculate time-based status
const getTimeStatus = (task: any) => {
  const now = new Date();
  const createdAt = new Date(task.createdAt);
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  
  // Hours since creation
  const hoursSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
  
  // Hours until due
  let hoursUntilDue = null;
  let isOverdue = false;
  let isDueToday = false;
  
  if (dueDate) {
    const msUntilDue = dueDate.getTime() - now.getTime();
    hoursUntilDue = Math.floor(msUntilDue / (1000 * 60 * 60));
    
    // Check if overdue based on time spent vs estimated hours
    if (task.estimatedHours && task.actualHours) {
  isOverdue = task.actualHours > task.estimatedHours;
} else if (task.estimatedHours) {
  isOverdue = hoursSinceCreation > task.estimatedHours;
} else {
  isOverdue = now > dueDate;
}

    
    // Check if due today
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

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { type, workspaceId, projectId, status, priority } = req.query;
    console.log('📋 GET /api/tasks called');
    console.log('  User:', req.user?.email);
    console.log('  Query params:', req.query);

    let where: any = {};

    if (type === 'personal') {
      where = {
        projectId: null,
        createdById: req.user!.id,
      };
    } else if (type === 'assigned') {
      where = {
        assignees: {
          some: { userId: req.user!.id },
        },
      };
    } else if (type === 'created') {
      where = {
        createdById: req.user!.id,
      };
    } else {
      where = {
        OR: [
          { createdById: req.user!.id },
          { assignees: { some: { userId: req.user!.id } } },
          {
            project: {
              workspace: {
                OR: [
                  { ownerId: req.user!.id },
                  { members: { some: { userId: req.user!.id } } },
                ],
              },
            },
          },
        ],
      };
    }

    if (workspaceId) {
  where.project = { ...where.project, workspaceId };
}


    if (projectId) {
      where.projectId = projectId;
    }

    if (status) {
      where.status = status;
    }

    if (priority) {
      where.priority = priority;
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

    // Add time tracking info to each task
    const tasksWithTimeInfo = tasks.map(task => ({
      ...task,
      timeTracking: getTimeStatus(task),
    }));

    res.json({
      success: true,
      data: tasksWithTimeInfo,
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
    });
  }
};

// Replace the getTaskStats function in your task.controller.ts

export const getTaskStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { workspaceId } = req.query; // Get workspaceId from query params
    
    console.log('📊 GET /api/tasks/stats called');
    console.log('  User:', req.user?.email);
    console.log('  WorkspaceId:', workspaceId);
    console.log('  Query params:', req.query);

    // Build base where clause
    let baseWhere: any = {
      OR: [
        { createdById: userId },
        { assignees: { some: { userId } } },
      ],
    };

    // If workspaceId provided, filter by workspace
    if (workspaceId && typeof workspaceId === 'string') {
      baseWhere = {
        ...baseWhere,
        project: {
          workspaceId: workspaceId,
        },
      };
    }

    // Personal tasks (no project) - exclude when filtering by workspace
    const personalCount = await prisma.task.count({
      where: {
        projectId: null,
        createdById: userId,
        ...(workspaceId && { workspaceId: null }), // Exclude when filtering workspace
      },
    });

    // Assigned tasks
    const assignedCount = await prisma.task.count({
      where: {
        assignees: {
          some: { userId },
        },
        ...(workspaceId && {
          project: {
            workspaceId: workspaceId as string,
          },
        }),
      },
    });

    // Total tasks with filter
    const totalTasks = await prisma.task.count({
      where: baseWhere,
    });

    // In Progress count
    const inProgress = await prisma.task.count({
      where: {
        ...baseWhere,
        status: 'IN_PROGRESS',
      },
    });

    // Completed count
    const completed = await prisma.task.count({
      where: {
        ...baseWhere,
        status: 'COMPLETED',
      },
    });

    // Status counts
    const statusCounts = await prisma.task.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: true,
    });

    // Get all tasks to calculate smart overdue based on estimated hours
    const allUserTasks = await prisma.task.findMany({
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
    });

    // Calculate overdue count with smart logic
    let overdueCount = 0;
    allUserTasks.forEach(task => {
      const timeStatus = getTimeStatus(task);
      if (timeStatus.isOverdue) {
        overdueCount++;
      }
    });

    // Due today calculation
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

    const stats = {
      personal: workspaceId ? 0 : personalCount, // Hide personal when filtering workspace
      assigned: assignedCount,
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

    console.log('📊 Stats computed:', stats);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task statistics',
    });
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      projectId,
      status,
      priority,
      dueDate,
      startDate,
      estimatedHours,
      assigneeIds,
      labelIds,
      parentId,

      // 🔥 Focura focus features
      focusRequired = false,
      focusLevel,
      energyType,
      distractionCost,
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Task title is required",
      });
    }

    // -----------------------------
    // Focus feature validation
    // -----------------------------
    if (focusLevel !== undefined && (focusLevel < 1 || focusLevel > 5)) {
      return res.status(400).json({
        success: false,
        message: "Focus level must be between 1 and 5",
      });
    }

    if (
      energyType &&
      !["LOW", "MEDIUM", "HIGH"].includes(energyType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid energy type",
      });
    }

    if (distractionCost !== undefined && distractionCost < 0) {
      return res.status(400).json({
        success: false,
        message: "Distraction cost cannot be negative",
      });
    }

    // Prevent overload (focus-first principle)
    if (assigneeIds?.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Too many assignees reduce task focus",
      });
    }

    // -----------------------------
    // Workspace access resolution
    // -----------------------------
    let finalWorkspaceId: string | null = null;

    if (projectId) {
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          workspace: {
            OR: [
              { ownerId: req.user!.id },
              { members: { some: { userId: req.user!.id } } },
            ],
          },
        },
      });

      if (!project) {
        return res.status(403).json({
          success: false,
          message: "You do not have access to this project",
        });
      }

      finalWorkspaceId = project.workspaceId;
    }

    // -----------------------------
    // Smart default priority (Focura logic)
    // -----------------------------
    let computedPriority = priority ?? "MEDIUM";

    if (!priority && dueDate) {
      const hoursLeft =
        (new Date(dueDate).getTime() - Date.now()) / 36e5;

      if (hoursLeft <= 24) computedPriority = "HIGH";
    }

    // -----------------------------
    // Build Prisma data
    // -----------------------------
    const taskData: any = {
      title,
      description,
      status: status || "TODO",
      priority: computedPriority,
      dueDate: dueDate ? new Date(dueDate) : null,
      startDate: startDate ? new Date(startDate) : null,
      estimatedHours,

      // 🔥 Focus fields
      focusRequired,
      focusLevel,
      energyType,
      distractionCost,

      createdBy: {
        connect: { id: req.user!.id },
      },
    };

    if (projectId) {
      taskData.project = { connect: { id: projectId } };
    }

    if (finalWorkspaceId) {
      taskData.workspace = { connect: { id: finalWorkspaceId } };
    }

    if (parentId) {
      taskData.parent = { connect: { id: parentId } };
    }

    if (assigneeIds?.length) {
      taskData.assignees = {
        create: assigneeIds.map((userId: string) => ({ userId })),
      };
    }

    if (labelIds?.length) {
      taskData.labels = {
        create: labelIds.map((labelId: string) => ({ labelId })),
      };
    }

    // -----------------------------
    // Create task
    // -----------------------------
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

    // -----------------------------
    // Activity log
    // -----------------------------
    if (finalWorkspaceId) {
      await prisma.activity.create({
        data: {
          action: "CREATED",
          entityType: "TASK",
          entityId: task.id,
          userId: req.user!.id,
          workspaceId: finalWorkspaceId,
          taskId: task.id,
          metadata: {
            taskTitle: task.title,
            focusRequired,
            energyType,
          },
        },
      });
    }

    // -----------------------------
    // Notifications
    // -----------------------------
    if (assigneeIds?.length) {
      for (const userId of assigneeIds) {
        if (userId !== req.user!.id) {
          notifyUser({
            userId,
            senderId: req.user!.id,
            type: "TASK_ASSIGNED",
            title: "New Task Assigned",
            message: `${req.user!.name || "Someone"} assigned you a task`,
            actionUrl: `/dashboard/tasks/${task.id}`,
          }).catch(() => {});
        }
      }
    }

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: {
        ...task,
        timeTracking: getTimeStatus(task),
      },
    });
  } catch (error) {
    console.error("Create task error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create task",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};


export const getTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findFirst({
      where: {
        id,
        OR: [
          { createdById: req.user!.id },
          { assignees: { some: { userId: req.user!.id 

          } } },
          {
            project: {
              workspace: {
                OR: [
                  { ownerId: req.user!.id },
                  { members: { some: { userId: req.user!.id } } },
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
      return res.status(404).json({
        success: false,
        message: 'Task not found',
      });
    }
    // console.log('User:', req.user);


    // Add time tracking info
    const taskWithTimeInfo = {
      ...task,
      timeTracking: getTimeStatus(task),
    };

    res.json({
      success: true,
      data: taskWithTimeInfo,
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task',
    });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      startDate,
      estimatedHours,
      assigneeIds,
      labelIds,
    } = req.body;

    const existingTask = await prisma.task.findFirst({
      where: {
        id,
        OR: [
          { createdById: req.user!.id },
          {
            project: {
              workspace: {
                members: {
                  some: {
                    userId: req.user!.id,
                    role: { in: ['OWNER', 'ADMIN', 'MEMBER'] },
                  },
                },
              },
            },
          },
        ],
      },
      include: { 
        project: true,
        assignees: true,
      },
    });

    if (!existingTask) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this task',
      });
    }

    const wasCompleted = status === 'COMPLETED' && existingTask.status !== 'COMPLETED';

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(dueDate !== undefined && {
          dueDate: dueDate ? new Date(dueDate) : null,
        }),
        ...(startDate !== undefined && {
          startDate: startDate ? new Date(startDate) : null,
        }),
        ...(estimatedHours !== undefined && { estimatedHours }),
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
        labels: {
          include: { label: true },
        },
        project: {
          select: { id: true, name: true, color: true },
        },
      },
    });

    if (assigneeIds !== undefined) {
      const existingAssigneeIds = existingTask.assignees.map(a => a.userId);
      const newAssigneeIds = assigneeIds as string[];
      const addedAssignees = newAssigneeIds.filter(
        uid => !existingAssigneeIds.includes(uid)
      );

      await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
      if (assigneeIds.length > 0) {
        await prisma.taskAssignee.createMany({
          data: assigneeIds.map((userId: string) => ({
            taskId: id,
            userId,
          })),
        });
      }

      for (const userId of addedAssignees) {
        if (userId !== req.user!.id) {
          try {
            await notifyUser({
              userId,
              senderId: req.user!.id,
              type: 'TASK_ASSIGNED',
              title: 'Task Assigned',
              message: `${req.user!.name || 'Someone'} assigned you to "${task.title}"`,
              actionUrl: `/dashboard/tasks/${id}`,
            });
          } catch (notifError) {
            console.error('Failed to send notification:', notifError);
          }
        }
      }
    }

    if (labelIds !== undefined) {
      await prisma.taskLabel.deleteMany({ where: { taskId: id } });
      if (labelIds.length > 0) {
        await prisma.taskLabel.createMany({
          data: labelIds.map((labelId: string) => ({
            taskId: id,
            labelId,
          })),
        });
      }
    }

    if (wasCompleted) {
      try {
        await notifyTaskAssignees({
          taskId: id,
          senderId: req.user!.id,
          type: 'TASK_COMPLETED',
          title: 'Task Completed',
          message: `${req.user!.name || 'Someone'} completed "${task.title}"`,
          excludeUserId: req.user!.id,
        });
      } catch (notifError) {
        console.error('Failed to send completion notification:', notifError);
      }
    }

    if (existingTask.project && existingTask.project.workspaceId) {
      await prisma.activity.create({
        data: {
          action: 'UPDATED',
          entityType: 'TASK',
          entityId: task.id,
          userId: req.user!.id,
          workspaceId: existingTask.project.workspaceId,
          taskId: task.id,
          metadata: {
            taskTitle: task.title,
            changes: req.body,
          },
        },
      });
    }

    // Add time tracking info
    const taskWithTimeInfo = {
      ...task,
      timeTracking: getTimeStatus(task),
    };

    res.json({
      success: true,
      message: 'Task updated successfully',
      data: taskWithTimeInfo,
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task',
    });
  }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: { status: true, title: true },
    });

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: { 
        status,
        ...(status === 'COMPLETED' && existingTask?.status !== 'COMPLETED' && {
          completedAt: new Date(),
        }),
      },
    });

    if (status === 'COMPLETED' && existingTask?.status !== 'COMPLETED') {
      try {
        await notifyTaskAssignees({
          taskId: req.params.id,
          senderId: req.user!.id,
          type: 'TASK_COMPLETED',
          title: 'Task Completed',
          message: `${req.user!.name || 'Someone'} completed "${existingTask?.title}"`,
          excludeUserId: req.user!.id,
        });
      } catch (notifError) {
        console.error('Failed to send completion notification:', notifError);
      }
    }

    // Add time tracking info
    const taskWithTimeInfo = {
      ...updated,
      timeTracking: getTimeStatus(updated),
    };

    res.json({ success: true, data: taskWithTimeInfo });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findFirst({
      where: {
        id,
        OR: [
          { createdById: req.user!.id },
          {
            project: {
              workspace: {
                members: {
                  some: {
                    userId: req.user!.id,
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
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this task',
      });
    }

    await prisma.task.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task',
    });
  }
};

export const testNotification = async (req: AuthRequest, res: Response) => {
  try {
    await notifyUser({
      userId: req.user!.id,
      type: 'TASK_ASSIGNED',
      title: '🧪 Test Notification',
      message: 'This is a test notification. If you see this, notifications are working!',
      actionUrl: '/dashboard',
    });

    res.json({
      success: true,
      message: 'Test notification sent! Check your notification bell.',
    });
  } catch (error) {
    console.error('Test notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};