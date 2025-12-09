// services/task.service.ts (add notification hooks)
import { prisma } from "../index.js";
import { notifyUser, notifyTaskAssignees } from "../utils/notification.helpers.js";
export const TaskService = {
    /**
     * Create task and notify assignees
     */
    async createTask(data) {
        const task = await prisma.task.create({
            data: {
                title: data.title,
                description: data.description,
                projectId: data.projectId,
                createdById: data.createdById,
                // ... other fields
            },
        });
        // Assign users if provided
        if (data.assigneeIds && data.assigneeIds.length > 0) {
            await prisma.taskAssignee.createMany({
                data: data.assigneeIds.map((userId) => ({
                    taskId: task.id,
                    userId,
                })),
            });
            // Get creator name
            const creator = await prisma.user.findUnique({
                where: { id: data.createdById },
                select: { name: true },
            });
            // Notify assignees (exclude creator)
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
    async assignUserToTask(params) {
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
    async completeTask(taskId, completedBy) {
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
    async addComment(params) {
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
        if (!task)
            return comment;
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
    async updateTaskStatus(params) {
        const task = await prisma.task.update({
            where: { id: params.taskId },
            data: { status: params.status },
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
//# sourceMappingURL=task.service.js.map