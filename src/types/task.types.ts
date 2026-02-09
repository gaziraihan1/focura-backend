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