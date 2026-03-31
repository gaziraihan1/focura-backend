import { Router } from 'express';
import * as WorkspaceController from './workspace.controller.js';
import { authenticate } from '../../middleware/auth.js';
import {
  requireWorkspaceCreationSlot,
  requireMemberSlot,
} from '../billing/index.js';
import { getAttachmentStats } from '../attachment/index.js';
import { getWorkspaceStorage } from '../attachment/attachment.controller.js';
import { workspaceAnnouncementRouter } from '../announcement/index.js';

const router = Router();

router.get('/invitations/:token', WorkspaceController.getInvitation);
router.use(authenticate);

router.get('/', WorkspaceController.getAllWorkspaces);
router.post('/', requireWorkspaceCreationSlot, WorkspaceController.createWorkspace);
router.get('/:slug', WorkspaceController.getWorkspace);
router.put('/:id', WorkspaceController.updateWorkspace);
router.delete('/:id', WorkspaceController.deleteWorkspace);
router.get('/:id/members', WorkspaceController.getMembers);
router.post('/:id/invite', requireMemberSlot, WorkspaceController.inviteMember);
router.delete('/:id/members/:memberId', WorkspaceController.removeMember);
router.put('/:id/members/:memberId/role', WorkspaceController.updateMemberRole);
router.get('/:id/stats', WorkspaceController.getStats);

router.get('/:workspaceId/attachments/stats', getAttachmentStats);
router.get('/:workspaceId/storage', getWorkspaceStorage);

// ── Announcements
router.use('/:workspaceId/announcements', workspaceAnnouncementRouter);

router.post('/invitations/:token/accept', WorkspaceController.acceptInvitation);
router.post('/:id/leave', WorkspaceController.leaveWorkspace);

export default router;