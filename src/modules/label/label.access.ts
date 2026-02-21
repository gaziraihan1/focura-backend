/**
 * label.access.ts
 * Responsibility: Authorization checks for the Label domain.
 *
 * The original had 4 private functions (`checkLabelAccess`, `checkLabelEditPermission`,
 * `checkDuplicateLabelName`, `checkTaskAccess`) defined at module scope in the
 * service file — mixed with service logic, untestable in isolation, and typed as `any`.
 *
 * Fixed here:
 *  - `label: any` in checkLabelEditPermission → typed with a Prisma-compatible shape.
 *  - `where: any` in checkDuplicateLabelName → typed as Record<string, unknown>.
 *  - checkLabelAccess + getLabel were two DB calls for the same record.
 *    assertLabelAccess now returns the label so callers reuse it (no double fetch).
 */

import { prisma } from '../../index.js';
import {
  NotFoundError,
  UnauthorizedError,
  ConflictError,
} from './label.types.js';

/** Minimal label shape needed for permission checks */
interface LabelForPermission {
  createdById: string;
  workspaceId: string | null;
}

export const LabelAccess = {
  /**
   * Verifies the user can view the label.
   *  - Workspace label → user must be a workspace member.
   *  - Personal label → user must be the creator.
   *
   * Returns the label so callers don't need to fetch it again.
   */
  async assertLabelAccess(labelId: string, userId: string) {
    const label = await prisma.label.findUnique({
      where:   { id: labelId },
      include: { workspace: true },
    });

    if (!label) throw new NotFoundError('Label not found');

    if (label.workspaceId) {
      const member = await prisma.workspaceMember.findFirst({
        where: { workspaceId: label.workspaceId, userId },
      });
      if (!member) throw new UnauthorizedError('Access denied');
    } else if (label.createdById !== userId) {
      throw new UnauthorizedError('Access denied');
    }

    return label;
  },

  /**
   * Returns true if the user can edit or delete the label.
   *  - Label creator always can.
   *  - Workspace owner always can.
   *  - Workspace ADMIN members can.
   */
  async canEditLabel(label: LabelForPermission, userId: string): Promise<boolean> {
    if (label.createdById === userId) return true;

    if (label.workspaceId) {
      const workspace = await prisma.workspace.findUnique({
        where:  { id: label.workspaceId },
        select: { ownerId: true },
      });

      if (workspace?.ownerId === userId) return true;

      const adminMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: label.workspaceId, userId, role: 'ADMIN' },
      });

      return !!adminMember;
    }

    return false;
  },

  /**
   * Throws ConflictError if a label with the same name already exists
   * in the same scope (workspace or personal).
   */
  async assertNoDuplicateName(
    name: string,
    workspaceId: string | null | undefined,
    createdById: string,
    excludeLabelId?: string,
  ): Promise<void> {
    const where: Record<string, unknown> = {
      name: { equals: name, mode: 'insensitive' },
    };

    if (workspaceId) {
      where.workspaceId = workspaceId;
    } else {
      where.workspaceId = null;
      where.createdById = createdById;
    }

    if (excludeLabelId) {
      where.id = { not: excludeLabelId };
    }

    const existing = await prisma.label.findFirst({ where });

    if (existing) {
      const scope = workspaceId ? 'workspace' : 'your personal labels';
      throw new ConflictError(`Label with this name already exists in ${scope}`);
    }
  },

  /**
   * Verifies the user can access the task (created, assigned, or workspace member).
   * Throws NotFoundError if not found or no access.
   */
  async assertTaskAccess(taskId: string, userId: string) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        OR: [
          { createdById: userId },
          { assignees: { some: { userId } } },
          {
            project: {
              workspace: {
                OR: [
                  { ownerId: userId },
                  { members: { some: { userId } } },
                ],
              },
            },
          },
        ],
      },
    });

    if (!task) throw new NotFoundError('Task not found or access denied');

    return task;
  },
};