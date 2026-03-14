import { Router } from 'express';
import { WorkspaceUsageController } from './workspaceUsage.controller.js';

const router = Router();

router.get('/:workspaceId/usage', WorkspaceUsageController.getWorkspaceUsage);

export default router;