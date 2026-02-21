/**
 * storage.routes.ts
 * Responsibility: Route definitions for the Storage domain.
 *
 * Route order is already correct in the original:
 *  /workspaces (named) comes before /:workspaceId/* (param prefix).
 */

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

// ─── User-level (no workspace param) ─────────────────────────────────────────
router.get('/workspaces', getWorkspacesSummary);

// ─── Workspace-level reads ────────────────────────────────────────────────────
router.get('/:workspaceId/overview',            getWorkspaceOverview);
router.get('/:workspaceId/info',                getWorkspaceInfo);
router.get('/:workspaceId/my-contribution',     getMyContribution);
router.get('/:workspaceId/user-contributions',  getUserContributions);
router.get('/:workspaceId/largest-files',       getLargestFiles);

// ─── Workspace-level writes ───────────────────────────────────────────────────
router.post('/:workspaceId/bulk-delete',        bulkDelete);
router.delete('/files/:fileId',                 deleteFile); // ← ADD THIS
router.post('/:workspaceId/check-upload',       checkUpload);

export default router;