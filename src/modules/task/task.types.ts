/**
 * task.types.ts
 * Responsibility: All types, interfaces, and domain enums for the Task domain.
 *
 * The original had ~15 inline anonymous types across functions.
 * All extracted here with proper names.
 */

// ─── Domain enums ─────────────────────────────────────────────────────────────

export type TaskStatus   = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskIntent   = 'EXECUTION' | 'PLANNING' | 'REVIEW' | 'LEARNING' | 'COMMUNICATION';
export type EnergyType   = 'LOW' | 'MEDIUM' | 'HIGH';

// ─── Filter params ────────────────────────────────────────────────────────────

export interface TaskFilterParams {
  userId:      string;
  type?:       string;
  workspaceId?: string;
  projectId?:  string;
  status?:     string;
  priority?:   string;
  labelIds?:   string[];
  assigneeId?: string;
  search?:     string;
}

export interface PaginationParams {
  page?:     number;
  pageSize?: number;
}

export interface SortParams {
  sortBy?:    'dueDate' | 'priority' | 'status' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// ─── Input shapes ─────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  title:            string;
  description?:     string;
  projectId?:       string;
  status?:          string;
  priority?:        string;
  dueDate?:         Date;
  startDate?:       Date;
  estimatedHours?:  number;
  assigneeIds?:     string[];
  labelIds?:        string[];
  parentId?:        string;
  focusRequired?:   boolean;
  focusLevel?:      number;
  energyType?:      EnergyType;
  distractionCost?: number;
  intent?:          TaskIntent;
  createdById:      string;
}

export interface UpdateTaskInput {
  title?:            string;
  description?:      string;
  status?:           string;
  priority?:         string;
  dueDate?:          Date | null;
  startDate?:        Date | null;
  estimatedHours?:   number;
  assigneeIds?:      string[];
  labelIds?:         string[];
  focusRequired?:    boolean;
  focusLevel?:       number;
  energyType?:       EnergyType | null;
  distractionCost?:  number;
  intent?:           TaskIntent;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface TimeTracking {
  hoursSinceCreation: number;
  hoursUntilDue:      number | null;
  isOverdue:          boolean;
  isDueToday:         boolean;
  timeProgress:       number | null;
}

export interface TaskStats {
  personal:   number;
  assigned:   number;
  created:    number;
  overdue:    number;
  dueToday:   number;
  totalTasks: number;
  inProgress: number;
  completed:  number;
  byStatus:   Record<string, number>;
}

export interface PaginatedTasksResult<T = any> {
  data: T[];
  pagination: {
    page:       number;
    pageSize:   number;
    totalCount: number;
    totalPages: number;
    hasNext:    boolean;
    hasPrev:    boolean;
  };
}

export interface EditPermissionResult {
  canEdit: boolean;
  reason?: string;
}

// ─── Minimal typed shapes for permission checks ──────────────────────────────

/**
 * Minimal task shape needed for permission checks.
 * Avoids fetching full task with comments/subtasks/files.
 */
export interface TaskForPermission {
  id:          string;
  createdById: string;
  projectId:   string | null;
  project?: {
    members: Array<{ role: string }>;
    workspace?: {
      members: Array<{ role: string }>;
    };
  } | null;
}

/**
 * Minimal task shape needed for time tracking computation.
 */
export interface TaskForTimeTracking {
  createdAt:       Date;
  dueDate:         Date | null;
  status:          string;
  estimatedHours?: number | null;
  actualHours?:    number | null;
}