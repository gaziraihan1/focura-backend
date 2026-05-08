import { prisma } from '../../../lib/prisma.js';
import { SubtaskAccess } from './subtask.access.js';
import { getTimeStatus } from '../index.js';

const subtaskInclude = {
  createdBy: {
    select: { id: true, name: true, email: true, image: true },
  },
  assignees: {
    include: {
      user: { select: { id: true, name: true, email: true, image: true } },
    },
  },
  _count: {
    select: { comments: true, files: true },
  },
} as const;

export const SubtaskQuery = {
  async getSubtasks(parentTaskId: string, userId: string) {
    // Assert user has access to the parent task
    await SubtaskAccess.assertParentTaskAccess(parentTaskId, userId);

    const subtasks = await prisma.task.findMany({
      where:   { parentId: parentTaskId, depth: 1 },
      include: subtaskInclude,
      orderBy: { createdAt: 'asc' },
    });

    return subtasks.map((s) => ({ ...s, timeTracking: getTimeStatus(s) }));
  },

  async getSubtaskById(subtaskId: string, userId: string) {
    // First find the subtask
    const subtask = await prisma.task.findFirst({
      where:   { id: subtaskId, depth: 1 },
      include: subtaskInclude,
    });

    if (!subtask) throw new Error('NOT_FOUND: Subtask not found');
    if (!subtask.parentId) throw new Error('NOT_FOUND: Subtask has no parent');

    // Then assert access via parent
    await SubtaskAccess.assertParentTaskAccess(subtask.parentId, userId);

    return { ...subtask, timeTracking: getTimeStatus(subtask) };
  },

  async getSubtaskStats(parentTaskId: string, userId: string) {
    await SubtaskAccess.assertParentTaskAccess(parentTaskId, userId);

    const [total, completed, inProgress] = await Promise.all([
      prisma.task.count({ where: { parentId: parentTaskId, depth: 1 } }),
      prisma.task.count({ where: { parentId: parentTaskId, depth: 1, status: 'COMPLETED' } }),
      prisma.task.count({ where: { parentId: parentTaskId, depth: 1, status: 'IN_PROGRESS' } }),
    ]);

    return {
      total,
      completed,
      inProgress,
      todo:            total - completed - inProgress,
      completionRate:  total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  },
};