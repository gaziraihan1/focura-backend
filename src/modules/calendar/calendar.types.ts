
export type {
  CalendarDayAggregate,
  BurnoutSignal,
  GoalCheckpoint,
  SystemCalendarEvent,
} from '@prisma/client';

export interface CalendarFilters {
  userId: string;
  workspaceId?: string;
  startDate: Date;
  endDate: Date;
}

export interface TimeAllocation {
  deepWork: number;
  meetings: number;
  admin: number;
  learning: number;
}

export interface CalendarInsights {
  totalPlannedHours: number;
  totalCapacityHours: number;
  commitmentGap: number;
  overloadedDays: number;
  focusDays: number;
  burnoutRisk: string;
  timeAllocation: TimeAllocation | null;
}

export interface CreateGoalCheckpointInput {
  userId: string;
  workspaceId?: string;
  title: string;
  type: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'KPI';
  targetDate: Date;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';