import { Router } from 'express';
import {
  createAnnouncement,
  getAnnouncements,
  getAnnouncement,
  deleteAnnouncement,
  togglePinAnnouncement,
  getProjectAnnouncements,
} from './announcement.controller.js';

export const workspaceAnnouncementRouter = Router({ mergeParams: true });

workspaceAnnouncementRouter.get( '/', getAnnouncements);
workspaceAnnouncementRouter.post('/', createAnnouncement);

export const projectAnnouncementRouter = Router({ mergeParams: true });

projectAnnouncementRouter.get('/', getProjectAnnouncements);

export const announcementRouter = Router();

announcementRouter.get(   '/:id',     getAnnouncement);
announcementRouter.delete('/:id',     deleteAnnouncement);
announcementRouter.patch( '/:id/pin', togglePinAnnouncement);