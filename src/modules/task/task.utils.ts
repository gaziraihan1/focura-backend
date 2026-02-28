
import type { TaskForTimeTracking, TimeTracking } from './task.types.js';

export function getTimeStatus(task: TaskForTimeTracking, now = new Date()): TimeTracking {
  const createdAt = new Date(task.createdAt);
  const dueDate   = task.dueDate ? new Date(task.dueDate) : null;

  const hoursSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

  let hoursUntilDue: number | null = null;
  let isOverdue   = false;
  let isDueToday  = false;

  if (dueDate) {
    const msUntilDue = dueDate.getTime() - now.getTime();
    hoursUntilDue    = Math.floor(msUntilDue / (1000 * 60 * 60));

    if (task.estimatedHours && task.actualHours) {
      isOverdue = task.actualHours > task.estimatedHours;
    } else if (task.estimatedHours) {
      isOverdue = hoursSinceCreation > task.estimatedHours;
    } else {
      isOverdue = now > dueDate;
    }

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    isDueToday = dueDate >= todayStart && dueDate <= todayEnd;
  }

  return {
    hoursSinceCreation,
    hoursUntilDue,
    isOverdue: task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && isOverdue,
    isDueToday,
    timeProgress: task.estimatedHours
      ? Math.min(100, Math.round((hoursSinceCreation / task.estimatedHours) * 100))
      : null,
  };
}

export function getTimeStatusBatch(tasks: TaskForTimeTracking[]): Map<string, TimeTracking> {
  const now    = new Date();
  const result = new Map<string, TimeTracking>();

  for (const task of tasks) {
    result.set((task as any).id, getTimeStatus(task, now));
  }

  return result;
}