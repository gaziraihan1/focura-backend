/**
 * activity.query.ts
 * Responsibility: Read-only SELECT operations for the Activity domain.
 *
 * Rules:
 *  - No writes, no deletes, no auth checks.
 *  - Authorization is the caller's responsibility (controller calls
 *    ActivityAccess before calling these).
 *  - All functions return typed Prisma results — never raw `any`.
 */

import { prisma } from '../../index.js';
import type {
  ActivityFilters,
  WorkspaceActivityFilters,
  TaskActivityFilters,
} from './activity.types.js';
import {
  activityFullInclude,
  activitySlimInclude,
  activityUserOnlyInclude,
} from './activity.selects.js';

export const ActivityQuery = {
  /**
   * Activities visible to a user across all their workspaces and tasks.
   * Includes activities they authored, are assigned to, or workspace members.
   */
  async getUserActivities(userId: string, filters: ActivityFilters = {}) {
    const where: Record<string, unknown> = {
      OR: [
        { userId },
        {
          workspace: {
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } },
            ],
          },
        },
        { task: { assignees: { some: { userId } } } },
        { task: { createdById: userId } },
      ],
    };

    if (filters.workspaceId) where.workspaceId = filters.workspaceId;
    if (filters.entityType)  where.entityType  = filters.entityType;
    if (filters.action)      where.action      = filters.action;

    if (filters.startDate || filters.endDate) {
      const createdAt: Record<string, Date> = {};
      if (filters.startDate) createdAt.gte = filters.startDate;
      if (filters.endDate)   createdAt.lte = filters.endDate;
      where.createdAt = createdAt;
    }

    return prisma.activity.findMany({
      where,
      include:  activityFullInclude,
      orderBy:  { createdAt: 'desc' },
      take:     filters.limit  ?? 50,
      skip:     filters.offset ?? 0,
    });
  },

  /**
   * All activities scoped to a workspace.
   * Caller must verify workspace access before calling this.
   */
  async getWorkspaceActivities(
    workspaceId: string,
    filters: WorkspaceActivityFilters = {},
  ) {
    const where: Record<string, unknown> = { workspaceId };

    if (filters.action)     where.action     = filters.action;
    if (filters.entityType) where.entityType = filters.entityType;

    return prisma.activity.findMany({
      where,
      include:  activitySlimInclude,
      orderBy:  { createdAt: 'desc' },
      take:     filters.limit  ?? 50,
      skip:     filters.offset ?? 0,
    });
  },

  /**
   * Activities for a specific task, newest first.
   * Caller must verify task access before calling this.
   */
  async getTaskActivities(taskId: string, filters: TaskActivityFilters = {}) {
    return prisma.activity.findMany({
      where:    { taskId },
      include:  activityUserOnlyInclude,
      orderBy:  { createdAt: 'desc' },
      take:     filters.limit  ?? 50,
      skip:     filters.offset ?? 0,
    });
  },
};