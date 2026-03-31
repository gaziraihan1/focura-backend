import type { Response } from 'express';
import { z }             from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { AnnouncementService } from './announcement.service.js';
import { prisma }              from '../../index.js';
import { notifyWorkspaceMembers, notifyUser } from '../notification/notification.helpers.js';
import {
  createAnnouncementSchema,
  listAnnouncementsSchema,
} from './announcement.validation.js';

// ─── Error handler — matches task.controller handleError exactly ──────────────

function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    return;
  }

  if (error instanceof Error) {
    const msg = error.message;
    if (msg.startsWith('NOT_FOUND:')) {
      res.status(404).json({ success: false, message: msg.replace('NOT_FOUND: ', '') });
    } else if (msg.startsWith('FORBIDDEN:')) {
      res.status(403).json({ success: false, message: msg.replace('FORBIDDEN: ', '') });
    } else if (msg.startsWith('BAD_REQUEST:')) {
      res.status(400).json({ success: false, message: msg.replace('BAD_REQUEST: ', '') });
    } else {
      console.error(`${label} error:`, error);
      res.status(500).json({ success: false, message: `Failed to ${label}` });
    }
    return;
  }

  console.error(`${label} error:`, error);
  res.status(500).json({ success: false, message: `Failed to ${label}` });
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const body = createAnnouncementSchema.parse(req.body);

    const announcement = await AnnouncementService.create(
      { ...body, workspaceId, createdById: req.user!.id },
      async ({ announcement, workspaceId: wsId, creatorName }) => {
        const actionUrl = `/dashboard/workspaces/${workspaceId}/announcements/${announcement.id}`;

        // ── Activity log
        void prisma.activity.create({
          data: {
            action:      'CREATED',
            entityType:  'WORKSPACE',
            entityId:    announcement.id,
            userId:      req.user!.id,
            workspaceId: wsId,
            metadata: {
              announcementTitle: announcement.title,
              visibility:        announcement.visibility,
              isPinned:          announcement.isPinned,
            },
          },
        }).catch((e) => console.error('Failed to log announcement activity:', e));

        // ── Notifications
        if (announcement.visibility === 'PUBLIC') {
          // Notify all workspace members
          void notifyWorkspaceMembers({
            workspaceId:   wsId,
            senderId:      req.user!.id,
            type:          'PROJECT_UPDATE',
            title:         '📢 New Announcement',
            message:       `${creatorName}: ${announcement.title}`,
            actionUrl,
            excludeUserId: req.user!.id,
          });
        } else {
          // PRIVATE — notify only targets
          const targetIds = (announcement.targets ?? [])
            .map((t: any) => t.userId)
            .filter((uid: string) => uid !== req.user!.id);

          await Promise.allSettled(
            targetIds.map((userId: string) =>
              notifyUser({
                userId,
                senderId:  req.user!.id,
                type:      'PROJECT_UPDATE',
                title:     '🔒 Private Announcement',
                message:   `${creatorName} shared an announcement with you: ${announcement.title}`,
                actionUrl,
              }),
            ),
          );
        }
      },
    );

    res.status(201).json({ success: true, message: 'Announcement created', data: announcement });
  } catch (error) {
    handleError(res, 'create announcement', error);
  }
};

export const getAnnouncements = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const query = listAnnouncementsSchema.parse(req.query);

    const result = await AnnouncementService.getMany({
      workspaceId,
      userId:   req.user!.id,
      ...query,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, 'fetch announcements', error);
  }
};

export const getAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await AnnouncementService.getOne(
      req.params.id,
      req.user!.id,
    );
    res.json({ success: true, data: announcement });
  } catch (error) {
    handleError(res, 'fetch announcement', error);
  }
};

export const deleteAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    await AnnouncementService.delete(
      req.params.id,
      req.user!.id,
      async ({ announcement, workspaceId }) => {
        void prisma.activity.create({
          data: {
            action:      'DELETED',
            entityType:  'WORKSPACE',
            entityId:    announcement.id,
            userId:      req.user!.id,
            workspaceId,
            metadata: { announcementTitle: announcement.title },
          },
        }).catch((e) => console.error('Failed to log announcement deletion:', e));
      },
    );

    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    handleError(res, 'delete announcement', error);
  }
};

export const togglePinAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const announcement = await AnnouncementService.togglePin(
      req.params.id,
      req.user!.id,
    );
    res.json({ success: true, data: announcement });
  } catch (error) {
    handleError(res, 'toggle pin announcement', error);
  }
};