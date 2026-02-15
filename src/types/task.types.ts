// lib/types/task.types.ts

export type TaskIntent =
  | 'EXECUTION'
  | 'PLANNING'
  | 'REVIEW'
  | 'LEARNING'
  | 'COMMUNICATION';

export type EnergyType = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CreateTaskDTO {
  title: string;
  description?: string;
  projectId?: string;
  assigneeIds?: string[];
  status?: string;
  priority?: string;
  dueDate?: Date;
  startDate?: Date;
  estimatedHours?: number;
  focusRequired?: boolean;
  focusLevel?: number;
  energyType?: EnergyType;
  distractionCost?: number;
  intent?: TaskIntent;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimatedHours?: number;
  focusRequired?: boolean;
  focusLevel?: number;
  energyType?: EnergyType | null;
  distractionCost?: number;
  intent?: TaskIntent;
}

export interface AssignUserDTO {
  taskId: string;
  userId: string;
  assignedBy: string;
}

export interface AddCommentDTO {
  taskId: string;
  userId: string;
  content: string;
}

// types/task.types.ts

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate: string | null;
  startDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  completedAt?: Date;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  projectId?: string;
  workspaceId?: string;
  parentId?: string;
  focusRequired?: boolean;
  focusLevel?: number;
  energyType?: 'LOW' | 'MEDIUM' | 'HIGH';
  distractionCost?: number;
  intent?: 'EXECUTION' | 'PLANNING' | 'REVIEW' | 'LEARNING' | 'COMMUNICATION';
  createdBy: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
  assignees: Array<{
    userId: string;
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
    };
  }>;
  labels?: Array<{
    labelId: string;
    label: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  project?: {
    id: string;
    name: string;
    color: string;
    workspaceId: string;
    workspace: {
      id: string;
      name: string;
      slug: string;
    };
  };
  _count?: {
    comments: number;
    subtasks: number;
    files: number;
  };
  timeTracking?: {
    hoursSinceCreation: number;
    hoursUntilDue: number | null;
    isOverdue: boolean;
    isDueToday: boolean;
    timeProgress: number | null;
  };
}

export interface TaskPagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface TasksResponse {
  data: Task[];
  pagination: TaskPagination;
}

export interface TaskStatsResponse {
  personal: number;
  assigned: number;
  created: number;
  overdue: number;
  dueToday: number;
  totalTasks: number;
  inProgress: number;
  completed: number;
  byStatus: Record<string, number>;
}

export interface TaskFilterParams {
  userId: string;
  type?: string;
  workspaceId?: string;
  projectId?: string;
  status?: string;
  priority?: string;
  labelIds?: string[];
  assigneeId?: string;
  search?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SortParams {
  sortBy?: 'dueDate' | 'priority' | 'status' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  projectId?: string;
  status?: string;
  priority?: string;
  dueDate?: Date;
  startDate?: Date;
  estimatedHours?: number;
  assigneeIds?: string[];
  labelIds?: string[];
  parentId?: string;
  focusRequired?: boolean;
  focusLevel?: number;
  energyType?: 'LOW' | 'MEDIUM' | 'HIGH';
  distractionCost?: number;
  intent?: 'EXECUTION' | 'PLANNING' | 'REVIEW' | 'LEARNING' | 'COMMUNICATION';
  createdById: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: Date | null;
  startDate?: Date | null;
  estimatedHours?: number;
  assigneeIds?: string[];
  labelIds?: string[];
  focusRequired?: boolean;
  focusLevel?: number;
  energyType?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  distractionCost?: number;
  intent?: 'EXECUTION' | 'PLANNING' | 'REVIEW' | 'LEARNING' | 'COMMUNICATION';
}