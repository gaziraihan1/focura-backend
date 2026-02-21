/**
 * calendar.utils.ts
 * Responsibility: Pure date/time utility functions for the Calendar domain.
 *
 * Rules:
 *  - No Prisma, no HTTP, no imports from this module.
 *  - Every function is a pure transformation: same input → same output.
 *  - This makes them trivially unit-testable without any mocking.
 */

const DAY_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

/**
 * Returns a new Date set to midnight (00:00:00.000) in local time.
 * Never mutates the input.
 */
export function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Returns the end-of-day boundary (23:59:59.999) for a given date.
 */
export function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * Generates an inclusive array of normalized dates from startDate to endDate.
 */
export function generateDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = normalizeDate(startDate);
  const end = normalizeDate(endDate);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Converts an array of weekday strings ('MON', 'TUE', ...) to JS day numbers (0–6).
 * Unknown strings are silently dropped.
 */
export function getWorkDayNumbers(workDays: string[]): number[] {
  return workDays
    .map((day) => DAY_MAP[day])
    .filter((num): num is number => num !== undefined);
}

/**
 * Counts how many dates in the given range fall on configured work days.
 */
export function countWorkDays(
  startDate: Date,
  endDate: Date,
  workDays: string[],
): number {
  const workDayNumbers = getWorkDayNumbers(workDays);
  return generateDateRange(startDate, endDate).filter((date) =>
    workDayNumbers.includes(date.getDay()),
  ).length;
}

/**
 * Returns the maximum run of consecutive items in `items` that satisfy `condition`.
 * Items must already be sorted chronologically.
 */
export function countConsecutiveDays<T>(
  items: T[],
  condition: (item: T) => boolean,
): number {
  let max = 0;
  let current = 0;

  for (const item of items) {
    if (condition(item)) {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }

  return max;
}

/**
 * Returns true if the given date is a "natural" review day:
 * Sunday (end of week) or the 1st of the month.
 */
export function isReviewDay(date: Date): boolean {
  return date.getDay() === 0 || date.getDate() === 1;
}

/**
 * Returns the Monday of the ISO week containing `date`.
 */
export function getWeekStart(date: Date): Date {
  const normalized = normalizeDate(date);
  normalized.setDate(normalized.getDate() - normalized.getDay());
  return normalized;
}