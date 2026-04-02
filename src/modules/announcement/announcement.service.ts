import { AnnouncementRepository } from './announcement.repository.js';
import {
  canManageAnnouncements,
  canManageProjectAnnouncements,
  canViewAnnouncement,
} from './announcement.utils.js';
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilterParams,
} from './announcement.types.js';

type OnAnnouncementCreated = (data: {
  announcement: any;
  workspaceId:  string;
  creatorName:  string;
}) => Promise<void>;

type OnAnnouncementDeleted = (data: {
  announcement: any;
  workspaceId:  string;
}) => Promise<void>;

export const AnnouncementService = {
  async create(input: CreateAnnouncementInput, onCreated?: OnAnnouncementCreated) {
    // ── Workspace membership
    const member = await AnnouncementRepository.isWorkspaceMember(
      input.workspaceId, input.createdById,
    );
    if (!member) throw new Error('FORBIDDEN: You are not a member of this workspace');

    // ── Permission: project-scoped vs workspace-wide
    if (input.projectId) {
      const projectMember = await AnnouncementRepository.isProjectMember(
        input.projectId, input.createdById,
      );
      if (!canManageProjectAnnouncements(member.role, projectMember?.role ?? null)) {
        throw new Error('FORBIDDEN: Only workspace admins, owners, or project managers/leads can create project announcements');
      }
    } else {
      if (!canManageAnnouncements(member.role)) {
        throw new Error('FORBIDDEN: Only admins and owners can create workspace announcements');
      }
    }

    // ── Validate private targets are workspace members
    if (input.visibility === 'PRIVATE' && input.targetIds?.length) {
      const checks = await Promise.all(
        input.targetIds.map((uid) =>
          AnnouncementRepository.isWorkspaceMember(input.workspaceId, uid),
        ),
      );
      const invalid = input.targetIds.filter((_, i) => !checks[i]);
      if (invalid.length) throw new Error('BAD_REQUEST: Some target users are not workspace members');
    }

    const announcement = await AnnouncementRepository.create(input);

    console.log(`📢 Announcement created: "${announcement.title}" (${announcement.id})`);

    onCreated?.({
      announcement,
      workspaceId: input.workspaceId,
      creatorName: announcement.createdBy.name ?? 'Someone',
    }).catch((e) => console.error('Post-create callback failed:', e));

    return announcement;
  },

  async getMany(params: AnnouncementFilterParams) {
    const member = await AnnouncementRepository.isWorkspaceMember(
      params.workspaceId, params.userId,
    );
    if (!member) throw new Error('FORBIDDEN: You are not a member of this workspace');

    // For project-scoped fetch, also verify project membership
    if (params.projectId) {
      const projectMember = await AnnouncementRepository.isProjectMember(
        params.projectId, params.userId,
      );
      if (!projectMember) throw new Error('FORBIDDEN: You are not a member of this project');
    }

    return AnnouncementRepository.findMany(params);
  },

  async getOne(id: string, userId: string) {
    const announcement = await AnnouncementRepository.findById(id);
    if (!announcement) throw new Error('NOT_FOUND: Announcement not found');
    if (!canViewAnnouncement(announcement, userId))
      throw new Error('FORBIDDEN: You do not have access to this announcement');
    return announcement;
  },

  async delete(id: string, userId: string, onDeleted?: OnAnnouncementDeleted) {
    const announcement = await AnnouncementRepository.findById(id);
    if (!announcement) throw new Error('NOT_FOUND: Announcement not found');

    const member = await AnnouncementRepository.isWorkspaceMember(
      announcement.workspaceId, userId,
    );

    if (announcement.projectId) {
      const projectMember = await AnnouncementRepository.isProjectMember(
        announcement.projectId, userId,
      );
      if (!canManageProjectAnnouncements(member?.role ?? 'MEMBER', projectMember?.role ?? null))
        throw new Error('FORBIDDEN: Only workspace admins, owners, or project managers/leads can delete project announcements');
    } else {
      if (!member || !canManageAnnouncements(member.role))
        throw new Error('FORBIDDEN: Only admins and owners can delete announcements');
    }

    await AnnouncementRepository.delete(id);

    console.log(`🗑️  Announcement deleted: "${announcement.title}" (${id})`);

    onDeleted?.({ announcement, workspaceId: announcement.workspaceId })
      .catch((e) => console.error('Post-delete callback failed:', e));

    return { success: true };
  },

  async togglePin(id: string, userId: string) {
    const announcement = await AnnouncementRepository.findById(id);
    if (!announcement) throw new Error('NOT_FOUND: Announcement not found');

    const member = await AnnouncementRepository.isWorkspaceMember(
      announcement.workspaceId, userId,
    );

    if (announcement.projectId) {
      const projectMember = await AnnouncementRepository.isProjectMember(
        announcement.projectId, userId,
      );
      if (!canManageProjectAnnouncements(member?.role ?? 'MEMBER', projectMember?.role ?? null))
        throw new Error('FORBIDDEN: Only workspace admins, owners, or project managers/leads can pin announcements');
    } else {
      if (!member || !canManageAnnouncements(member.role))
        throw new Error('FORBIDDEN: Only admins and owners can pin announcements');
    }

    return AnnouncementRepository.update(id, { isPinned: !announcement.isPinned });
  },
};