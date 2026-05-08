
import { Router } from 'express';
import {
  getWorkspacesSummary,
  getWorkspaceOverview,
  getWorkspaceInfo,
  getMyContribution,
  getUserContributions,
  getLargestFiles,
  bulkDelete,
  checkUpload,
  deleteFile,
} from './storage.controller.js';

const router = Router();

router.get('/workspaces', getWorkspacesSummary);

router.get('/:workspaceId/overview',            getWorkspaceOverview);
router.get('/:workspaceId/info',                getWorkspaceInfo);
router.get('/:workspaceId/my-contribution',     getMyContribution);
router.get('/:workspaceId/user-contributions',  getUserContributions);
router.get('/:workspaceId/largest-files',       getLargestFiles);

router.post('/:workspaceId/bulk-delete',        bulkDelete);
router.delete('/files/:fileId',                 deleteFile);
router.post('/:workspaceId/check-upload',       checkUpload);

export default router;