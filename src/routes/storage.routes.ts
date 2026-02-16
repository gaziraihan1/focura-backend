// routes/storage.routes.ts
import { Router } from 'express';
import { StorageController } from '../controllers/storage.controller.js';

const router = Router();

/**
 * @route   GET /api/storage/workspaces
 * @desc    Get all workspaces summary for current user
 * @access  Private
 */
router.get('/workspaces', StorageController.getWorkspacesSummary);

/**
 * @route   GET /api/storage/:workspaceId/overview
 * @desc    Get complete storage overview for workspace
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/overview', StorageController.getWorkspaceOverview);

/**
 * @route   GET /api/storage/:workspaceId/info
 * @desc    Get basic storage info for workspace
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/info', StorageController.getWorkspaceInfo);

/**
 * @route   GET /api/storage/:workspaceId/my-contribution
 * @desc    Get current user's storage contribution to workspace
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/my-contribution', StorageController.getMyContribution);

/**
 * @route   GET /api/storage/:workspaceId/user-contributions
 * @desc    Get all users' storage contributions (admin only)
 * @access  Private (workspace owner/admin)
 */
router.get('/:workspaceId/user-contributions', StorageController.getUserContributions);

/**
 * @route   GET /api/storage/:workspaceId/largest-files
 * @desc    Get largest files in workspace
 * @query   limit - Number of files to return (default: 10)
 * @access  Private (workspace member)
 */
router.get('/:workspaceId/largest-files', StorageController.getLargestFiles);

/**
 * @route   POST /api/storage/:workspaceId/bulk-delete
 * @desc    Delete multiple files from workspace
 * @body    { fileIds: string[] }
 * @access  Private (file owner or workspace admin)
 */
router.post('/:workspaceId/bulk-delete', StorageController.bulkDelete);

/**
 * @route   POST /api/storage/:workspaceId/check-upload
 * @desc    Check if file can be uploaded to workspace
 * @body    { fileSize: number }
 * @access  Private (workspace member)
 */
router.post('/:workspaceId/check-upload', StorageController.checkUpload);

export default router;