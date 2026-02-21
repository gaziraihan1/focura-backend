/**
 * calendar.types.ts
 * Responsibility: All types and interfaces for the Calendar domain.
 *
 * Rules:
 *  - No imports from this module, no logic, no side effects.
 *  - Prisma model types are re-exported here so callers
 *    never need to import from @prisma/client directly.
 */

export type {
  CalendarDayAggregate,
  BurnoutSignal,
  GoalCheckpoint,
  SystemCalendarEvent,
} from '@prisma/client';

// ─── Filter shapes ─────────────────────────────────────────────────────────────

export interface CalendarFilters {
  userId: string;
  workspaceId?: string;
  startDate: Date;
  endDate: Date;
}

// ─── Computed / derived shapes ─────────────────────────────────────────────────

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
  /** null until real category tracking is implemented */
  timeAllocation: TimeAllocation | null;
}

// ─── Mutation input shapes ─────────────────────────────────────────────────────

export interface CreateGoalCheckpointInput {
  userId: string;
  workspaceId?: string;
  title: string;
  type: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'KPI';
  targetDate: Date;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';