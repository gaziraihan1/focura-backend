import { AnnouncementRepository } from './announcement.repository.js';
import { canManageAnnouncements, canViewAnnouncement } from './announcement.utils.js';
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilterParams,
} from './announcement.types.js';

// ─── Callback types (matching task.mutation.ts pattern) ───────────────────────

type OnAnnouncementCreated = (data: {
  announcement: any;
  workspaceId:  string;
  creatorName:  string;
}) => Promise<void>;

type OnAnnouncementDeleted = (data: {
  announcement: any;
  workspaceId:  string;
}) => Promise<void>;

// ─── Service ──────────────────────────────────────────────────────────────────

export const AnnouncementService = {
  async create(
    input:      CreateAnnouncementInput,
    onCreated?: OnAnnouncementCreated,
  ) {
    // ── Permission check
    const member = await AnnouncementRepository.isWorkspaceMember(
      input.workspaceId,
      input.createdById,
    );
    if (!member) {
      throw new Error('FORBIDDEN: You are not a member of this workspace');
    }
    if (!canManageAnnouncements(member.role)) {
      throw new Error('FORBIDDEN: Only admins and owners can create announcements');
    }

    // ── Validate private targets are workspace members
    if (input.visibility === 'PRIVATE' && input.targetIds?.length) {
      const memberChecks = await Promise.all(
        input.targetIds.map((uid) =>
          AnnouncementRepository.isWorkspaceMember(input.workspaceId, uid),
        ),
      );
      const invalidTargets = input.targetIds.filter((_, i) => !memberChecks[i]);
      if (invalidTargets.length > 0) {
        throw new Error('BAD_REQUEST: Some target users are not workspace members');
      }
    }

    const announcement = await AnnouncementRepository.create(input);

    console.log(`📢 Announcement created: "${announcement.title}" (${announcement.id})`);

    if (onCreated) {
      onCreated({
        announcement,
        workspaceId: input.workspaceId,
        creatorName: announcement.createdBy.name ?? 'Someone',
      }).catch((err) => console.error('Post-announcement-creation callback failed:', err));
    }

    return announcement;
  },

  async getMany(params: AnnouncementFilterParams) {
    const member = await AnnouncementRepository.isWorkspaceMember(
      params.workspaceId,
      params.userId,
    );
    if (!member) {
      throw new Error('FORBIDDEN: You are not a member of this workspace');
    }

    return AnnouncementRepository.findMany(params);
  },

  async getOne(id: string, userId: string) {
    const announcement = await AnnouncementRepository.findById(id);
    if (!announcement) throw new Error('NOT_FOUND: Announcement not found');

    if (!canViewAnnouncement(announcement as any, userId)) {
      throw new Error('FORBIDDEN: You do not have access to this announcement');
    }

    return announcement;
  },

  async delete(
    id:         string,
    userId:     string,
    onDeleted?: OnAnnouncementDeleted,
  ) {
    const announcement = await AnnouncementRepository.findById(id);
    if (!announcement) throw new Error('NOT_FOUND: Announcement not found');

    const member = await AnnouncementRepository.isWorkspaceMember(
      announcement.workspaceId,
      userId,
    );
    if (!member || !canManageAnnouncements(member.role)) {
      throw new Error('FORBIDDEN: Only admins and owners can delete announcements');
    }

    await AnnouncementRepository.delete(id);

    console.log(`🗑️  Announcement deleted: "${announcement.title}" (${id})`);

    if (onDeleted) {
      onDeleted({
        announcement,
        workspaceId: announcement.workspaceId,
      }).catch((err) => console.error('Post-announcement-deletion callback failed:', err));
    }

    return { success: true };
  },

  async togglePin(id: string, userId: string) {
    const announcement = await AnnouncementRepository.findById(id);
    if (!announcement) throw new Error('NOT_FOUND: Announcement not found');

    const member = await AnnouncementRepository.isWorkspaceMember(
      announcement.workspaceId,
      userId,
    );
    if (!member || !canManageAnnouncements(member.role)) {
      throw new Error('FORBIDDEN: Only admins and owners can pin announcements');
    }

    return AnnouncementRepository.update(id, { isPinned: !announcement.isPinned });
  },
};