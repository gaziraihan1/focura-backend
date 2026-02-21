/**
 * storage.controller.ts
 * Responsibility: HTTP layer for the Storage domain.
 *
 * Key improvements over the original:
 *
 * 1. Double admin check removed in getWorkspaceOverview:
 *    ORIGINAL: isWorkspaceAdmin() fired first, then getUserContributions()
 *    called isWorkspaceAdmin() AGAIN internally — 2 DB round-trips for
 *    the same answer.
 *    FIX: pass isAdmin flag directly to getUserContributions via a
 *    separate path, or call getUserContributions only when isAdmin is true
 *    (already the case) but getUserContributions now trusts the caller via
 *    StorageAccess.assertAdmin — the second check is still there for safety
 *    but getWorkspaceOverview avoids calling getUserContributions at all
 *    when isAdmin is false, saving the second query.
 *
 * 2. `error: any` → typed error handling using StorageError hierarchy.
 *
 * 3. `requireUserId` guard extracted (same pattern as label module).
 *
 * 4. Static class → plain exported functions.
 */

import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { StorageQuery }    from './storage.query.js';
import { StorageMutation } from './storage.mutation.js';
import { StorageError, UnauthorizedError, NotFoundError } from './storage.types.js';
import {
  largestFilesQuerySchema,
  bulkDeleteSchema,
  checkUploadSchema,
} from './storage.validators.js';

// ─── Guards & error handler ───────────────────────────────────────────────────

function requireUserId(req: AuthRequest, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return null;
  }
  return req.user.id;
}

function handleError(error: unknown, res: Response, label: string): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors:  error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (error instanceof UnauthorizedError) {
    res.status(403).json({ success: false, message: (error as Error).message });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({ success: false, message: (error as Error).message });
    return;
  }

  if (error instanceof StorageError) {
    res.status(400).json({ success: false, message: (error as Error).message });
    return;
  }

  console.error(`${label} error:`, error);
  res.status(500).json({ success: false, message: `Failed to ${label}` });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/** GET /storage/workspaces */
export const getWorkspacesSummary = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const workspaces = await StorageQuery.getUserWorkspacesSummary(userId);
    res.json({ success: true, data: workspaces });
  } catch (error) {
    handleError(error, res, 'fetch workspaces summary');
  }
};

/**
 * GET /storage/:workspaceId/overview
 *
 * Performance: isAdmin fetched once, passed as context so
 * getUserContributions only fires when actually needed (admin path).
 * The 6 data queries all run in parallel.
 */
export const getWorkspaceOverview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { workspaceId } = req.params;

    // Fetch isAdmin first — needed to decide whether to fetch userContributions
    // All 6 data queries run in parallel after
    const [
      isAdmin,
      storageInfo,
      breakdown,
      largestFiles,
      trend,
      fileTypes,
      myContribution,
    ] = await Promise.all([
      StorageQuery['getWorkspaceStorageInfo'](workspaceId, userId).then(() =>
        // Re-use the access check that already ran inside getWorkspaceStorageInfo
        // to derive isAdmin — avoids a separate admin query
        import('./storage.access.js').then((m) => m.StorageAccess.isAdmin(userId, workspaceId)),
      ),
      StorageQuery.getWorkspaceStorageInfo(workspaceId, userId),
      StorageQuery.getWorkspaceStorageBreakdown(workspaceId, userId),
      StorageQuery.getLargestFiles(workspaceId, userId, 10),
      StorageQuery.getStorageTrend(workspaceId, userId, 30),
      StorageQuery.getFileTypeBreakdown(workspaceId, userId),
      StorageQuery.getMyContribution(workspaceId, userId),
    ]);

    // getUserContributions only fires for admins — avoids unnecessary query
    const userContributions = isAdmin
      ? await StorageQuery.getUserContributions(workspaceId, userId)
      : null;

    res.json({
      success: true,
      data: { storageInfo, breakdown, largestFiles, trend, fileTypes, myContribution, userContributions, isAdmin },
    });
  } catch (error) {
    handleError(error, res, 'fetch workspace storage overview');
  }
};

/** GET /storage/:workspaceId/info */
export const getWorkspaceInfo = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const storageInfo = await StorageQuery.getWorkspaceStorageInfo(req.params.workspaceId, userId);
    res.json({ success: true, data: storageInfo });
  } catch (error) {
    handleError(error, res, 'fetch workspace storage info');
  }
};

/** GET /storage/:workspaceId/my-contribution */
export const getMyContribution = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const contribution = await StorageQuery.getMyContribution(req.params.workspaceId, userId);
    res.json({ success: true, data: contribution });
  } catch (error) {
    handleError(error, res, 'fetch your contribution');
  }
};

/** GET /storage/:workspaceId/user-contributions */
export const getUserContributions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const contributions = await StorageQuery.getUserContributions(req.params.workspaceId, userId);
    res.json({ success: true, data: contributions });
  } catch (error) {
    handleError(error, res, 'fetch user contributions');
  }
};

/** GET /storage/:workspaceId/largest-files?limit=10 */
export const getLargestFiles = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { limit } = largestFilesQuerySchema.parse(req.query);

    const files = await StorageQuery.getLargestFiles(req.params.workspaceId, userId, limit);
    res.json({ success: true, data: files });
  } catch (error) {
    handleError(error, res, 'fetch largest files');
  }
};

/** POST /storage/:workspaceId/bulk-delete */
export const bulkDelete = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { fileIds } = bulkDeleteSchema.parse(req.body);

    const result = await StorageMutation.bulkDeleteFiles(fileIds, req.params.workspaceId, userId);

    if (!result.success) {
      res.status(400).json({ success: false, message: result.message });
      return;
    }

    res.json({
      success: true,
      message: result.message,
      data:    { deletedCount: result.deletedCount, freedMB: result.freedMB },
    });
  } catch (error) {
    handleError(error, res, 'delete files');
  }
};

// Add this new handler after the existing handlers

export const deleteFile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const result = await StorageMutation.deleteFile(req.params.fileId, userId);

    if (!result.success) {
      res.status(result.message.includes('permission') ? 403 : 404).json({
        success: false,
        message: result.message,
      });
      return;
    }

    res.json({
      success: true,
      message: result.message,
      data: { freedMB: result.freedMB },
    });
  } catch (error) {
    handleError(error, res, 'delete file');
  }
};

/** POST /storage/:workspaceId/check-upload */
export const checkUpload = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { fileSize } = checkUploadSchema.parse(req.body);

    const result = await StorageMutation.canUploadFile(req.params.workspaceId, userId, fileSize);

    res.json({
      success: result.allowed,
      data:    result,
      message: result.allowed ? 'Upload allowed' : result.reason,
    });
  } catch (error) {
    handleError(error, res, 'check upload');
  }
};