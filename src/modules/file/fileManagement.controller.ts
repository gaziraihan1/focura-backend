/**
 * fileManagement.controller.ts
 * HTTP handlers for file management operations.
 */

import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { FileManagementQuery } from './fileManagement.query.js';
import { FileManagementMutation } from './fileManagement.mutation.js';
import type { FileFilters } from './fileManagement.types.js';

function requireUserId(req: AuthRequest, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return null;
  }
  return req.user.id;
}

function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes('access')) {
      res.status(403).json({ success: false, message: msg });
    } else if (msg.includes('not found')) {
      res.status(404).json({ success: false, message: msg });
    } else if (msg.includes('permission')) {
      res.status(403).json({ success: false, message: msg });
    } else {
      res.status(500).json({ success: false, message: `Failed to ${label}` });
    }
  } else {
    res.status(500).json({ success: false, message: `Failed to ${label}` });
  }
}

export const getFiles = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { workspaceId } = req.params;
    const {
      search,
      fileType,
      uploadedBy,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      page = '1',
      limit = '50',
    } = req.query;

    const filters: FileFilters = {
      search: search as string,
      fileType: fileType as string,
      uploadedBy: uploadedBy as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      sortBy: sortBy as 'name' | 'size' | 'date',
      sortOrder: sortOrder as 'asc' | 'desc',
    };

    const result = await FileManagementQuery.getFiles(
      workspaceId,
      userId,
      filters,
      parseInt(page as string),
      parseInt(limit as string)
    );

    res.json({ success: true, data: result });
  } catch (error) {
    handleError(res, 'fetch files', error);
  }
};

export const deleteFile = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { workspaceId, fileId } = req.params;
    await FileManagementMutation.deleteFile(fileId, workspaceId, userId);

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    handleError(res, 'delete file', error);
  }
};

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { workspaceId } = req.params;
    const stats = await FileManagementQuery.getFileTypeStats(workspaceId, userId);

    res.json({ success: true, data: stats });
  } catch (error) {
    handleError(res, 'fetch statistics', error);
  }
};

export const getUploaders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const { workspaceId } = req.params;
    const uploaders = await FileManagementQuery.getUploaders(workspaceId, userId);

    res.json({ success: true, data: uploaders });
  } catch (error) {
    handleError(res, 'fetch uploaders', error);
  }
};