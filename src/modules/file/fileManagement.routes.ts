
import { Router } from 'express';
import { getFiles, deleteFile, getStats, getUploaders } from './fileManagement.controller.js';

const router = Router();

router.get('/:workspaceId/files', getFiles);
router.delete('/:workspaceId/files/:fileId', deleteFile);
router.get('/:workspaceId/stats', getStats);
router.get('/:workspaceId/uploaders', getUploaders);

export default router;