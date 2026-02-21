export function minutesToHours(minutes: number | null): number {
  return Math.round((minutes || 0) / 60 * 100) / 100;
}

export function bytesToMB(bytes: number | null): number {
  return Math.round((bytes || 0) / (1024 * 1024) * 100) / 100;
}

export function getDayKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getWeekOfDay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}