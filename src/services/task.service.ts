// services/task.service.ts
import { prisma } from "../index.js";
import { notifyUser, notifyTaskAssignees } from "../utils/notification.helpers.js";

export const TaskService = {
  /**
   * Create task and notify assignees
   */
  async createTask(data: {
    title: string;
    description?: string;
    projectId?: string;
    createdById: string;
    assigneeIds?: string[];
    status?: string;
    priority?: string;
    dueDate?: Date;
    startDate?: Date;
    estimatedHours?: number;

    // Focus features (matching your Task model)
    focusRequired?: boolean;
    focusLevel?: number;
    energyType?: "LOW" | "MEDIUM" | "HIGH";
    distractionCost?: number;

    // TaskMetadata fields (optional)
    energy?: "LOW" | "MEDIUM" | "HIGH";
    effort?: "QUICK" | "MEDIUM" | "DEEP";
    intent?: "OUTCOME" | "LEARNING" | "MAINTENANCE" | "CREATIVE";
  }) {
    // Resolve workspaceId from project (if any)
    let workspaceId: string | null = null;

    if (data.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        select: { workspaceId: true },
      });

      if (!project) {
        throw new Error("Invalid project");
      }

      workspaceId = project.workspaceId;
    }

    // 🔐 Atomic creation
    const task = await prisma.$transaction(async (tx) => {
      // Build the task data object
      const taskData: any = {
        title: data.title,
        createdById: data.createdById,
        status: data.status || "TODO",
        priority: data.priority || "MEDIUM",
        
        // Focus features (stored directly on Task)
        focusRequired: data.focusRequired ?? false,
        focusLevel: data.focusLevel ?? 3,
        energyType: data.energyType,
        distractionCost: data.distractionCost ?? 1,
      };

      // Add optional fields
      if (data.description) {
        taskData.description = data.description;
      }

      if (data.dueDate) {
        taskData.dueDate = data.dueDate;
      }

      if (data.startDate) {
        taskData.startDate = data.startDate;
      }

      if (data.estimatedHours !== undefined) {
        taskData.estimatedHours = data.estimatedHours;
      }

      if (data.projectId) {
        taskData.project = { connect: { id: data.projectId } };
      }

      if (workspaceId) {
        taskData.workspace = { connect: { id: workspaceId } };
      }

      // Create the task
      const task = await tx.task.create({
        data: taskData,
      });

      
      // 👥 Assign users (safe + unique)
      if (data.assigneeIds?.length) {
        await tx.taskAssignee.createMany({
          data: data.assigneeIds.map((userId) => ({
            taskId: task.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }

      // 📝 Workspace activity (optional but correct)
      if (workspaceId) {
        await tx.activity.create({
          data: {
            action: "CREATED",
            entityType: "TASK",
            entityId: task.id,
            taskId: task.id,
            userId: data.createdById,
            workspaceId,
            metadata: {
              title: task.title,
            },
          },
        });
      }

      return task;
    });

    // 🔔 Notifications AFTER commit
    if (data.assigneeIds?.length) {
      const creator = await prisma.user.findUnique({
        where: { id: data.createdById },
        select: { name: true },
      });

      for (const userId of data.assigneeIds) {
        if (userId !== data.createdById) {
          await notifyUser({
            userId,
            senderId: data.createdById,
            type: "TASK_ASSIGNED",
            title: "New Task Assigned",
            message: `${creator?.name || "Someone"} assigned you to "${task.title}"`,
            actionUrl: `/dashboard/tasks/${task.id}`,
          });
        }
      }
    }

    return task;
  },

  /**
   * Assign user to task
   */
  async assignUserToTask(params: {
    taskId: string;
    userId: string;
    assignedBy: string;
  }) {
    const assignment = await prisma.taskAssignee.create({
      data: {
        taskId: params.taskId,
        userId: params.userId,
      },
    });

    const [task, assigner] = await Promise.all([
      prisma.task.findUnique({ where: { id: params.taskId } }),
      prisma.user.findUnique({
        where: { id: params.assignedBy },
        select: { name: true },
      }),
    ]);

    // Notify the assigned user (unless they assigned themselves)
    if (params.userId !== params.assignedBy && task) {
      await notifyUser({
        userId: params.userId,
        senderId: params.assignedBy,
        type: "TASK_ASSIGNED",
        title: "Task Assigned",
        message: `${assigner?.name || "Someone"} assigned you to "${task.title}"`,
        actionUrl: `/dashboard/tasks/${params.taskId}`,
      });
    }

    return assignment;
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
    const { notifyMentions } = await import("../utils/notification.helpers.js");
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
   * Update task status and notify if needed
   */
  async updateTaskStatus(params: {
    taskId: string;
    status: string;
    updatedBy: string;
  }) {
    const task = await prisma.task.update({
      where: { id: params.taskId },
      data: { status: params.status as any },
    });

    // Notify on certain status changes
    if (params.status === "COMPLETED") {
      const updater = await prisma.user.findUnique({
        where: { id: params.updatedBy },
        select: { name: true },
      });

      await notifyTaskAssignees({
        taskId: params.taskId,
        senderId: params.updatedBy,
        type: "TASK_COMPLETED",
        title: "Task Completed",
        message: `${updater?.name || "Someone"} marked "${task.title}" as completed`,
        excludeUserId: params.updatedBy,
      });
    }

    return task;
  },
};