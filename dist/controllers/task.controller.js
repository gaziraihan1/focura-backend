import { prisma } from '../index.js';
import { notifyUser, notifyTaskAssignees } from '../utils/notification.helpers.js';
// Helper function to calculate time-based status
const getTimeStatus = (task) => {
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
        }
        else if (task.estimatedHours) {
            isOverdue = hoursSinceCreation > task.estimatedHours;
        }
        else {
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
export const getTasks = async (req, res) => {
    try {
        const { type, workspaceId, projectId, status, priority } = req.query;
        console.log('📋 GET /api/tasks called');
        console.log('  User:', req.user?.email);
        console.log('  Query params:', req.query);
        let where = {};
        if (type === 'personal') {
            where = {
                projectId: null,
                createdById: req.user.id,
            };
        }
        else if (type === 'assigned') {
            where = {
                assignees: {
                    some: { userId: req.user.id },
                },
            };
        }
        else if (type === 'created') {
            where = {
                createdById: req.user.id,
            };
        }
        else {
            where = {
                OR: [
                    { createdById: req.user.id },
                    { assignees: { some: { userId: req.user.id } } },
                    {
                        project: {
                            workspace: {
                                OR: [
                                    { ownerId: req.user.id },
                                    { members: { some: { userId: req.user.id } } },
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
    }
    catch (error) {
        console.error('Get tasks error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch tasks',
        });
    }
};
export const getTaskStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date();
        console.log('📋 GET /api/tasks called');
        console.log('  User:', req.user?.email);
        console.log('  Query params:', req.query);
        const personalCount = await prisma.task.count({
            where: {
                projectId: null,
                createdById: userId,
            },
        });
        const assignedCount = await prisma.task.count({
            where: {
                assignees: {
                    some: { userId },
                },
            },
        });
        const statusCounts = await prisma.task.groupBy({
            by: ['status'],
            where: {
                OR: [
                    { createdById: userId },
                    { assignees: { some: { userId } } },
                ],
            },
            _count: true,
        });
        // Get all tasks to calculate smart overdue based on estimated hours
        const allUserTasks = await prisma.task.findMany({
            where: {
                status: { notIn: ['COMPLETED', 'CANCELLED'] },
                OR: [
                    { createdById: userId },
                    { assignees: { some: { userId } } },
                ],
            },
            select: {
                id: true,
                createdAt: true,
                dueDate: true,
                estimatedHours: true,
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
                dueDate: {
                    gte: today,
                    lt: tomorrow,
                },
                status: { notIn: ['COMPLETED', 'CANCELLED'] },
                OR: [
                    { createdById: userId },
                    { assignees: { some: { userId } } },
                ],
            },
        });
        res.json({
            success: true,
            data: {
                personal: personalCount,
                assigned: assignedCount,
                overdue: overdueCount,
                dueToday: dueTodayCount,
                byStatus: statusCounts.reduce((acc, item) => {
                    acc[item.status] = item._count;
                    return acc;
                }, {}),
            },
        });
    }
    catch (error) {
        console.error('Get task stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch task statistics',
        });
    }
};
export const createTask = async (req, res) => {
    try {
        const { title, description, projectId, status, priority, dueDate, startDate, estimatedHours, assigneeIds, labelIds, parentId, } = req.body;
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Task title is required',
            });
        }
        // Determine workspaceId based on projectId
        let finalWorkspaceId = null;
        if (projectId) {
            const project = await prisma.project.findFirst({
                where: {
                    id: projectId,
                    workspace: {
                        OR: [
                            { ownerId: req.user.id },
                            { members: { some: { userId: req.user.id } } },
                        ],
                    },
                },
            });
            if (!project) {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have access to this project',
                });
            }
            finalWorkspaceId = project.workspaceId;
        }
        // Build the data object using Prisma relations
        const taskData = {
            title,
            description,
            status: status || "TODO",
            priority: priority || "MEDIUM",
            dueDate: dueDate ? new Date(dueDate) : null,
            startDate: startDate ? new Date(startDate) : null,
            estimatedHours,
            createdBy: {
                connect: {
                    id: req.user.id,
                },
            },
        };
        // Connect to project if provided (using relation, not projectId)
        if (projectId) {
            taskData.project = {
                connect: { id: projectId }
            };
        }
        // Connect to workspace if it exists (using relation, not workspaceId)
        if (finalWorkspaceId) {
            taskData.workspace = {
                connect: { id: finalWorkspaceId }
            };
        }
        // Connect to parent task if provided
        if (parentId) {
            taskData.parent = {
                connect: { id: parentId }
            };
        }
        // Add assignees if provided
        if (assigneeIds && assigneeIds.length > 0) {
            taskData.assignees = {
                create: assigneeIds.map((userId) => ({ userId })),
            };
        }
        // Add labels if provided
        if (labelIds && labelIds.length > 0) {
            taskData.labels = {
                create: labelIds.map((labelId) => ({ labelId })),
            };
        }
        const task = await prisma.task.create({
            data: taskData,
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true, image: true },
                },
                assignees: {
                    include: {
                        user: { select: { id: true, name: true, email: true, image: true } },
                    },
                },
                labels: { include: { label: true } },
                project: {
                    select: {
                        id: true,
                        name: true,
                        color: true,
                        workspaceId: true,
                        workspace: {
                            select: { id: true, name: true }
                        }
                    }
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
        // Only create activity if it's a workspace task
        if (finalWorkspaceId) {
            await prisma.activity.create({
                data: {
                    action: 'CREATED',
                    entityType: 'TASK',
                    entityId: task.id,
                    userId: req.user.id,
                    workspaceId: finalWorkspaceId,
                    taskId: task.id,
                    metadata: {
                        taskTitle: task.title,
                    },
                },
            });
        }
        // Send notifications to assignees
        if (assigneeIds && assigneeIds.length > 0) {
            for (const userId of assigneeIds) {
                if (userId !== req.user.id) {
                    try {
                        await notifyUser({
                            userId,
                            senderId: req.user.id,
                            type: 'TASK_ASSIGNED',
                            title: 'New Task Assigned',
                            message: `${req.user.name || 'Someone'} assigned you to "${task.title}"`,
                            actionUrl: `/dashboard/tasks/${task.id}`,
                        });
                    }
                    catch (notifError) {
                        console.error('Failed to send notification:', notifError);
                    }
                }
            }
        }
        // Add time tracking info
        const taskWithTimeInfo = {
            ...task,
            timeTracking: getTimeStatus(task),
        };
        res.status(201).json({
            success: true,
            message: 'Task created successfully',
            data: taskWithTimeInfo,
        });
    }
    catch (error) {
        console.error('Create task error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create task',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
export const getTask = async (req, res) => {
    try {
        const { id } = req.params;
        const task = await prisma.task.findFirst({
            where: {
                id,
                OR: [
                    { createdById: req.user.id },
                    { assignees: { some: { userId: req.user.id
                            } } },
                    {
                        project: {
                            workspace: {
                                OR: [
                                    { ownerId: req.user.id },
                                    { members: { some: { userId: req.user.id } } },
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
    }
    catch (error) {
        console.error('Get task error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch task',
        });
    }
};
export const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, status, priority, dueDate, startDate, estimatedHours, assigneeIds, labelIds, } = req.body;
        const existingTask = await prisma.task.findFirst({
            where: {
                id,
                OR: [
                    { createdById: req.user.id },
                    {
                        project: {
                            workspace: {
                                members: {
                                    some: {
                                        userId: req.user.id,
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
            const newAssigneeIds = assigneeIds;
            const addedAssignees = newAssigneeIds.filter(uid => !existingAssigneeIds.includes(uid));
            await prisma.taskAssignee.deleteMany({ where: { taskId: id } });
            if (assigneeIds.length > 0) {
                await prisma.taskAssignee.createMany({
                    data: assigneeIds.map((userId) => ({
                        taskId: id,
                        userId,
                    })),
                });
            }
            for (const userId of addedAssignees) {
                if (userId !== req.user.id) {
                    try {
                        await notifyUser({
                            userId,
                            senderId: req.user.id,
                            type: 'TASK_ASSIGNED',
                            title: 'Task Assigned',
                            message: `${req.user.name || 'Someone'} assigned you to "${task.title}"`,
                            actionUrl: `/dashboard/tasks/${id}`,
                        });
                    }
                    catch (notifError) {
                        console.error('Failed to send notification:', notifError);
                    }
                }
            }
        }
        if (labelIds !== undefined) {
            await prisma.taskLabel.deleteMany({ where: { taskId: id } });
            if (labelIds.length > 0) {
                await prisma.taskLabel.createMany({
                    data: labelIds.map((labelId) => ({
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
                    senderId: req.user.id,
                    type: 'TASK_COMPLETED',
                    title: 'Task Completed',
                    message: `${req.user.name || 'Someone'} completed "${task.title}"`,
                    excludeUserId: req.user.id,
                });
            }
            catch (notifError) {
                console.error('Failed to send completion notification:', notifError);
            }
        }
        if (existingTask.project && existingTask.project.workspaceId) {
            await prisma.activity.create({
                data: {
                    action: 'UPDATED',
                    entityType: 'TASK',
                    entityId: task.id,
                    userId: req.user.id,
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
    }
    catch (error) {
        console.error('Update task error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update task',
        });
    }
};
export const updateTaskStatus = async (req, res) => {
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
                    senderId: req.user.id,
                    type: 'TASK_COMPLETED',
                    title: 'Task Completed',
                    message: `${req.user.name || 'Someone'} completed "${existingTask?.title}"`,
                    excludeUserId: req.user.id,
                });
            }
            catch (notifError) {
                console.error('Failed to send completion notification:', notifError);
            }
        }
        // Add time tracking info
        const taskWithTimeInfo = {
            ...updated,
            timeTracking: getTimeStatus(updated),
        };
        res.json({ success: true, data: taskWithTimeInfo });
    }
    catch (err) {
        res.status(400).json({ error: err.message });
    }
};
export const deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const task = await prisma.task.findFirst({
            where: {
                id,
                OR: [
                    { createdById: req.user.id },
                    {
                        project: {
                            workspace: {
                                members: {
                                    some: {
                                        userId: req.user.id,
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
    }
    catch (error) {
        console.error('Delete task error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete task',
        });
    }
};
export const testNotification = async (req, res) => {
    try {
        await notifyUser({
            userId: req.user.id,
            type: 'TASK_ASSIGNED',
            title: '🧪 Test Notification',
            message: 'This is a test notification. If you see this, notifications are working!',
            actionUrl: '/dashboard',
        });
        res.json({
            success: true,
            message: 'Test notification sent! Check your notification bell.',
        });
    }
    catch (error) {
        console.error('Test notification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test notification',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
//# sourceMappingURL=task.controller.js.map