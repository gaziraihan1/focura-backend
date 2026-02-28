import { Router } from 'express';
import { WorkspaceUsageController } from '../controllers/workspace-usage.controller.js';

const router = Router();

router.get('/:workspaceId/usage', WorkspaceUsageController.getWorkspaceUsage);

export default router;