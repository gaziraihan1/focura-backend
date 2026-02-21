/**
 * activity.mutation.ts
 * Responsibility: Write operations for the Activity domain.
 *
 * Rules:
 *  - Only CREATE, UPDATE, DELETE operations here.
 *  - Authorization is delegated to ActivityAccess — never embedded inline.
 *  - No HTTP concepts, no response formatting.
 */

import { prisma } from '../../index.js';
import type { CreateActivityParams, ClearActivitiesFilters } from './activity.types.js';
import { activityFullInclude } from './activity.selects.js';
import { ActivityAccess } from './activity.access.js';

export const ActivityMutation = {
  /**
   * Creates a new activity log entry.
   * Returns the full activity with user, workspace and task context.
   */
  async createActivity(params: CreateActivityParams) {
    return prisma.activity.create({
      data: {
        action:      params.action,
        entityType:  params.entityType,
        entityId:    params.entityId,
        userId:      params.userId,
        workspaceId: params.workspaceId,
        taskId:      params.taskId,
        metadata:    params.metadata ?? {},
      },
      include: activityFullInclude,
    });
  },

  /**
   * Deletes a single activity record.
   * Delegates permission check to ActivityAccess.assertCanDelete.
   * Throws if the activity doesn't exist or caller lacks permission.
   */
  async deleteActivity(activityId: string, callerId: string): Promise<void> {
    // Authorization is checked here — before any DB write
    await ActivityAccess.assertCanDelete(callerId, activityId);

    await prisma.activity.delete({
      where: { id: activityId },
    });
  },

  /**
   * Bulk-deletes all activities belonging to a user.
   * Optionally scoped to a workspace and/or capped at a cutoff date.
   *
   * Returns the count of deleted records.
   */
  async clearUserActivities(
    userId: string,
    filters: ClearActivitiesFilters = {},
  ): Promise<number> {
    const where: Record<string, unknown> = { userId };

    if (filters.workspaceId) where.workspaceId = filters.workspaceId;
    if (filters.before)      where.createdAt   = { lte: filters.before };

    const result = await prisma.activity.deleteMany({ where });
    return result.count;
  },
};