/**
 * activity.types.ts
 * Responsibility: All types and interfaces for the Activity domain.
 *
 * Rules:
 *  - No imports, no logic, no side effects.
 *  - Every other file in this module imports from here.
 *  - This file never imports from anywhere inside the module.
 */

export type ActivityType =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'COMPLETED'
  | 'ASSIGNED'
  | 'UNASSIGNED'
  | 'COMMENTED'
  | 'UPLOADED'
  | 'MOVED'
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED';

export type EntityType =
  | 'TASK'
  | 'PROJECT'
  | 'COMMENT'
  | 'FILE'
  | 'WORKSPACE'
  | 'MEMBER';

// ─── Query filters ────────────────────────────────────────────────────────────

export interface ActivityFilters {
  workspaceId?: string;
  entityType?: EntityType;
  action?: ActivityType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export type WorkspaceActivityFilters = Pick<
  ActivityFilters,
  'action' | 'entityType' | 'limit' | 'offset'
>;

export type TaskActivityFilters = Pick<ActivityFilters, 'limit' | 'offset'>;

export interface ClearActivitiesFilters {
  workspaceId?: string;
  before?: Date;
}

// ─── Mutation params ──────────────────────────────────────────────────────────

export interface CreateActivityParams {
  action: ActivityType;
  entityType: EntityType;
  entityId: string;
  userId: string;
  workspaceId: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface ActivityStats {
  total: number;
  today: number;
  byAction: Record<string, number>;
}

export interface PaginatedMeta {
  limit: number;
  offset: number;
  hasMore: boolean;
}