import type { AnnouncementResult } from './announcement.types.js';

/**
 * Check if a user can manage (create/delete/pin) announcements.
 * Only OWNER and ADMIN roles can manage.
 */
export function canManageAnnouncements(role?: string): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

/**
 * Check if a user can view a specific announcement.
 * PUBLIC → any member.
 * PRIVATE → creator or explicit target.
 */
export function canViewAnnouncement(
  announcement: AnnouncementResult,
  userId: string,
): boolean {
  if (announcement.visibility === 'PUBLIC') return true;
  if (announcement.createdById === userId) return true;
  return announcement.targets.some((t) => t.userId === userId);
}