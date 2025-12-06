// routes/workspace.routes.ts
import { Router } from 'express';
import { WorkspaceController } from '../controllers/workspace.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ⚠️ PUBLIC ROUTES (MUST BE BEFORE authenticate middleware)
router.get('/invitations/:token', WorkspaceController.getInvitation);

// ⚠️ All other routes require authentication
router.use(authenticate);

// Workspace CRUD
router.get('/', WorkspaceController.getAllWorkspaces);
router.post('/', WorkspaceController.createWorkspace);
router.get('/:slug', WorkspaceController.getWorkspace);
router.put('/:id', WorkspaceController.updateWorkspace);
router.delete('/:id', WorkspaceController.deleteWorkspace);

// Members
router.get('/:id/members', WorkspaceController.getMembers);
router.post('/:id/invite', WorkspaceController.inviteMember);
router.delete('/:id/members/:memberId', WorkspaceController.removeMember);
router.put('/:id/members/:memberId/role', WorkspaceController.updateMemberRole);

// Stats
router.get('/:id/stats', WorkspaceController.getStats);

// Invitations (authenticated)
router.post('/invitations/:token/accept', WorkspaceController.acceptInvitation);

// Leave
router.post('/:id/leave', WorkspaceController.leaveWorkspace);

export default router;