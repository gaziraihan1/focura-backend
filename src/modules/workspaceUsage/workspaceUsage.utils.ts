/**
 * workspaceUsage.utils.ts
 * Utility functions for date calculations and metrics.
 */

export function bytesToMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

export function daysBetween(date1: Date, date2: Date): number {
  return Math.floor(
    (date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function getDateRange(days: number): Date[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return d;
  });
}

export function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function getMonthRange(
  months: number,
): Array<{ start: Date; end: Date; label: string }> {
  const now = new Date();
  return Array.from({ length: months }, (_, i) => {
    const monthStart = new Date(
      now.getFullYear(),
      now.getMonth() - (months - 1 - i),
      1,
    );
    const monthEnd = new Date(
      now.getFullYear(),
      now.getMonth() - (months - 1 - i) + 1,
      0,
      23,
      59,
      59,
    );
    return {
      start: monthStart,
      end: monthEnd,
      label: monthStart.toLocaleString("default", {
        month: "short",
        year: "numeric",
      }),
    };
  });
}
