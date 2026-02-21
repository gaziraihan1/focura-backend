/**
 * label.mutation.ts
 * Responsibility: Write operations for the Label domain.
 *
 * Each mutation follows: authorize → validate business rules → write.
 * No HTTP concepts, no inline `any` types.
 */

import { prisma } from '../../index.js';
import type { CreateLabelDto, UpdateLabelDto } from './label.types.js';
import { NotFoundError, UnauthorizedError } from './label.types.js';
import { labelListInclude, taskLabelInclude } from './label.selects.js';
import { LabelAccess } from './label.access.js';

export const LabelMutation = {
  /**
   * Creates a new label (personal or workspace-scoped).
   * Enforces workspace membership and duplicate name check.
   */
  async createLabel(data: CreateLabelDto) {
    if (data.workspaceId) {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: data.workspaceId, userId: data.createdById },
      });

      if (!member) throw new UnauthorizedError('Access denied to workspace');
    }

    await LabelAccess.assertNoDuplicateName(data.name, data.workspaceId, data.createdById);

    return prisma.label.create({
      data: {
        name:        data.name,
        color:       data.color,
        description: data.description,
        workspaceId: data.workspaceId,
        createdById: data.createdById,
      },
      include: labelListInclude,
    });
  },

  /**
   * Updates an existing label.
   * Only creator, workspace owner, or workspace ADMIN can edit.
   */
  async updateLabel(labelId: string, userId: string, data: UpdateLabelDto) {
    const existingLabel = await prisma.label.findUnique({
      where:   { id: labelId },
      include: { workspace: true },
    });

    if (!existingLabel) throw new NotFoundError('Label not found');

    const canEdit = await LabelAccess.canEditLabel(existingLabel, userId);
    if (!canEdit) {
      throw new UnauthorizedError(
        'Only label creator, workspace owner or admins can edit labels',
      );
    }

    // Only check for duplicates if the name is actually changing
    if (data.name && data.name !== existingLabel.name) {
      await LabelAccess.assertNoDuplicateName(
        data.name,
        existingLabel.workspaceId,
        existingLabel.createdById,
        labelId,
      );
    }

    return prisma.label.update({
      where: { id: labelId },
      data: {
        ...(data.name  !== undefined             && { name:  data.name }),
        ...(data.color !== undefined             && { color: data.color }),
        ...(data.description !== undefined       && { description: data.description }),
      },
      include: labelListInclude,
    });
  },

  /**
   * Deletes a label and returns how many tasks were affected.
   */
  async deleteLabel(labelId: string, userId: string) {
    const label = await prisma.label.findUnique({
      where:   { id: labelId },
      include: { _count: { select: { tasks: true } }, workspace: true },
    });

    if (!label) throw new NotFoundError('Label not found');

    const canEdit = await LabelAccess.canEditLabel(label, userId);
    if (!canEdit) {
      throw new UnauthorizedError(
        'Only label creator, workspace owner or admins can delete labels',
      );
    }

    await prisma.label.delete({ where: { id: labelId } });

    return { tasksAffected: label._count.tasks };
  },

  /**
   * Associates a label with a task.
   * Throws ConflictError if the association already exists.
   */
  async addLabelToTask(labelId: string, taskId: string, userId: string) {
    await LabelAccess.assertTaskAccess(taskId, userId);

    const label = await prisma.label.findUnique({ where: { id: labelId } });
    if (!label) throw new NotFoundError('Label not found');

    const existing = await prisma.taskLabel.findUnique({
      where: { taskId_labelId: { taskId, labelId } },
    });

    if (existing) {
      const { ConflictError } = await import('./label.types.js');
      throw new ConflictError('Label already added to task');
    }

    return prisma.taskLabel.create({
      data:    { taskId, labelId },
      include: taskLabelInclude,
    });
  },

  /**
   * Removes a label from a task.
   * Throws NotFoundError if the association doesn't exist.
   */
  async removeLabelFromTask(labelId: string, taskId: string, userId: string) {
    await LabelAccess.assertTaskAccess(taskId, userId);

    const taskLabel = await prisma.taskLabel.findUnique({
      where: { taskId_labelId: { taskId, labelId } },
    });

    if (!taskLabel) throw new NotFoundError('Label not found on task');

    await prisma.taskLabel.delete({
      where: { taskId_labelId: { taskId, labelId } },
    });
  },
};