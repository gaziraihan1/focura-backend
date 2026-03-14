import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { StorageQuery }    from './storage.query.js';
import { StorageMutation } from './storage.mutation.js';
import { StorageAccess }   from './storage.access.js';
import { StorageError, UnauthorizedError, NotFoundError } from './storage.types.js';
import {
  largestFilesQuerySchema,
  bulkDeleteSchema,
  checkUploadSchema,
} from './storage.validators.js';

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

export const getWorkspaceOverview = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { workspaceId } = req.params;

    // Run access check + isAdmin in one query, then fetch everything else in parallel.
    // Previously this called getWorkspaceStorageInfo twice (once buried in the isAdmin
    // check, once for real). Now isAdmin is resolved directly from StorageAccess.
    const [isAdmin, storageInfo, breakdown, largestFiles, trend, fileTypes, myContribution] =
      await Promise.all([
        StorageAccess.isAdmin(userId, workspaceId),
        StorageQuery.getWorkspaceStorageInfo(workspaceId, userId),
        StorageQuery.getWorkspaceStorageBreakdown(workspaceId, userId),
        StorageQuery.getLargestFiles(workspaceId, userId, 10),
        StorageQuery.getStorageTrend(workspaceId, userId, 30),
        StorageQuery.getFileTypeBreakdown(workspaceId, userId),
        StorageQuery.getMyContribution(workspaceId, userId),
      ]);

    // Admin-only: per-user breakdown (extra query only when needed)
    const userContributions = isAdmin
      ? await StorageQuery.getUserContributions(workspaceId, userId)
      : null;

    res.json({
      success: true,
      data: {
        storageInfo,
        breakdown,
        largestFiles,
        trend,
        fileTypes,
        myContribution,
        userContributions,
        isAdmin,
      },
    });
  } catch (error) {
    handleError(error, res, 'fetch workspace storage overview');
  }
};

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

    res.json({ success: true, message: result.message, data: { freedMB: result.freedMB } });
  } catch (error) {
    handleError(error, res, 'delete file');
  }
};

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