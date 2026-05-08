
import { TIER_LIMITS, type UploadLimits } from './attachment.types.js';

export function getLimitsForPlan(plan: string): UploadLimits {
  return TIER_LIMITS[plan] || TIER_LIMITS.FREE;
}

export function bytesToMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

export function getTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function getTodayEnd(): Date {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}