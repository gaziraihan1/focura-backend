// lib/repositories/task.repository.ts

import { prisma } from "../index.js";

interface CreateTaskWithAssigneesData {
  title: string;
  description?: string;
  projectId?: string;
  workspaceId?: string | null;
  createdById: string;
  assigneeIds?: string[];
  status: string;
  priority: string;
  dueDate?: Date;
  startDate?: Date;
  estimatedHours?: number;
  focusRequired: boolean;
  focusLevel: number;
  energyType?: string;
  distractionCost: number;
  intent: string;
}

class TaskRepository {
  async createWithAssignees(data: CreateTaskWithAssigneesData) {
    return prisma.$transaction(async (tx) => {
      const taskData: any = {
        title: data.title,
        createdById: data.createdById,
        status: data.status,
        priority: data.priority,
        focusRequired: data.focusRequired,
        focusLevel: data.focusLevel,
        distractionCost: data.distractionCost,
        intent: data.intent,
      };

      if (data.description) taskData.description = data.description;
      if (data.dueDate) taskData.dueDate = data.dueDate;
      if (data.startDate) taskData.startDate = data.startDate;
      if (data.estimatedHours !== undefined) taskData.estimatedHours = data.estimatedHours;
      if (data.energyType) taskData.energyType = data.energyType;
      if (data.projectId) taskData.project = { connect: { id: data.projectId } };
      if (data.workspaceId) taskData.workspace = { connect: { id: data.workspaceId } };

      const task = await tx.task.create({ data: taskData });

      if (data.assigneeIds?.length) {
        await tx.taskAssignee.createMany({
          data: data.assigneeIds.map(userId => ({ taskId: task.id, userId })),
          skipDuplicates: true,
        });
      }

      return task;
    });
  }

  async findById(id: string) {
    return prisma.task.findUnique({
      where: { id },
      include: {
        assignees: {
          include: {
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        labels: { include: { label: true } },
        project: { select: { id: true, name: true, color: true, workspaceId: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true, files: true, subtasks: true } },
      },
    });
  }

  async update(id: string, data: any) {
    const updateData: any = {};
    
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.focusRequired !== undefined) updateData.focusRequired = data.focusRequired;
    if (data.focusLevel !== undefined) updateData.focusLevel = data.focusLevel;
    if (data.energyType !== undefined) updateData.energyType = data.energyType;
    if (data.distractionCost !== undefined) updateData.distractionCost = data.distractionCost;
    if (data.intent !== undefined) updateData.intent = data.intent;

    return prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
  }

  async complete(id: string) {
    return prisma.task.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
  }

  async addAssignee(taskId: string, userId: string) {
    return prisma.taskAssignee.create({
      data: { taskId, userId },
    });
  }

  async createComment(data: { taskId: string; userId: string; content: string }) {
    return prisma.comment.create({
      data,
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });
  }

  async getWorkspaceIdFromProject(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    });
    return project?.workspaceId || null;
  }

  async findByIntent(params: { userId: string; intent: string; workspaceId?: string }) {
    const where: any = {
      intent: params.intent,
      OR: [
        { createdById: params.userId },
        { assignees: { some: { userId: params.userId } } },
      ],
      status: { notIn: ['COMPLETED', 'CANCELLED'] },
    };

    if (params.workspaceId) {
      where.workspaceId = params.workspaceId;
    }

    return prisma.task.findMany({
      where,
      include: {
        assignees: {
          include: { user: { select: { id: true, name: true, email: true, image: true } } },
        },
        labels: { include: { label: true } },
        project: { select: { id: true, name: true, color: true } },
      },
      orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
    });
  }

  async userCanUpdate(taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { createdById: userId },
          { assignees: { some: { userId } } },
          {
            project: {
              workspace: {
                members: { some: { userId, role: { in: ['OWNER', 'ADMIN'] } } },
              },
            },
          },
        ],
      },
    });
    return !!task;
  }

  async userHasAccess(taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { createdById: userId },
          { assignees: { some: { userId } } },
          {
            project: {
              workspace: { members: { some: { userId } } },
            },
          },
        ],
      },
    });
    return !!task;
  }

  async getAssignees(taskId: string) {
    const assignees = await prisma.taskAssignee.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return assignees.map(a => a.user);
  }
}

export const taskRepository = new TaskRepository();