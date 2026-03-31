import { Router } from 'express';
import {
  createAnnouncement,
  getAnnouncements,
  getAnnouncement,
  deleteAnnouncement,
  togglePinAnnouncement,
} from './announcement.controller.js';

// Workspace-scoped routes mounted at /workspaces/:workspaceId/announcements
export const workspaceAnnouncementRouter = Router({ mergeParams: true });

workspaceAnnouncementRouter.get('/',    getAnnouncements);
workspaceAnnouncementRouter.post('/',   createAnnouncement);

// Standalone routes mounted at /announcements
export const announcementRouter = Router();

announcementRouter.get('/:id',          getAnnouncement);
announcementRouter.delete('/:id',       deleteAnnouncement);
announcementRouter.patch('/:id/pin',    togglePinAnnouncement);