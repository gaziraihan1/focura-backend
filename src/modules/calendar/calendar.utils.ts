
const DAY_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

export function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

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

export function getWorkDayNumbers(workDays: string[]): number[] {
  return workDays
    .map((day) => DAY_MAP[day])
    .filter((num): num is number => num !== undefined);
}

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

export function isReviewDay(date: Date): boolean {
  return date.getDay() === 0 || date.getDate() === 1;
}

export function getWeekStart(date: Date): Date {
  const normalized = normalizeDate(date);
  normalized.setDate(normalized.getDate() - normalized.getDay());
  return normalized;
}