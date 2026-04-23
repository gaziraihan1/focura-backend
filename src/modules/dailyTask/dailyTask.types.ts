export type DailyTaskType = 'PRIMARY' | 'SECONDARY';

export interface GetDailyTasksParams {
  userId: string;
  date: Date;
}

export interface GetDailyTaskStatsParams {
  userId: string;
  startDate: Date;
  endDate: Date;
}

export interface AddDailyTaskParams {
  userId: string;
  taskId: string;
  type: DailyTaskType;
  date?: Date;
}

export interface RemoveDailyTaskParams {
  userId: string;
  taskId: string;
  date?: Date;
}

export interface DailyTaskStats {
  totalDays: number;
  primaryTasksSet: number;
  secondaryTasksSet: number;
  primaryTasksCompleted: number;
  secondaryTasksCompleted: number;
  primaryCompletionRate: number;
  secondaryCompletionRate: number;
}

export interface ClearExpiredResult {
  deletedCount: number;
}