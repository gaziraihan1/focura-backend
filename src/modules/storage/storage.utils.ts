/**
 * storage.utils.ts
 * Responsibility: Pure utility functions for the Storage domain.
 *
 * Three things extracted from the service class:
 *  1. toMB() — the bytes→MB conversion was written out 15+ times inline.
 *  2. getMaxFileSizeForPlan() — private static method, zero DB, pure lookup.
 *  3. getCategoryFromMimeType() — private static method, pure string logic.
 *
 * All functions are pure: no DB, no side effects, same input → same output.
 */

/**
 * Converts bytes to MB, rounded to 2 decimal places.
 * Centralises the `Math.round((bytes / (1024 * 1024)) * 100) / 100` pattern
 * that appeared 15+ times across the original service.
 */
export function toMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 100) / 100;
}

/** Plan-specific per-file upload size limits in MB. */
const PLAN_FILE_SIZE_LIMITS: Record<string, number> = {
  FREE:       5,
  PRO:        25,
  BUSINESS:   100,
  ENTERPRISE: 500,
};

/**
 * Returns the maximum single-file upload size in MB for a given plan.
 * Defaults to FREE limit (5 MB) for unknown plans.
 */
export function getMaxFileSizeForPlan(plan: string): number {
  return PLAN_FILE_SIZE_LIMITS[plan] ?? 5;
}

/**
 * Maps a MIME type string to a human-readable file category.
 */
export function getCategoryFromMimeType(mimeType: string): string {
  if (mimeType.startsWith('image/'))                                       return 'Images';
  if (mimeType.startsWith('video/'))                                       return 'Videos';
  if (mimeType.includes('pdf'))                                            return 'PDFs';
  if (mimeType.includes('word') || mimeType.includes('document'))         return 'Documents';
  if (mimeType.includes('sheet') || mimeType.includes('excel'))           return 'Spreadsheets';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentations';
  if (mimeType.includes('zip') || mimeType.includes('archive'))           return 'Archives';
  return 'Other';
}