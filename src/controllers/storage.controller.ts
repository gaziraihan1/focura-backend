// controllers/storage.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { StorageService } from '../services/storage.service.js';

export class StorageController {
  // GET /api/storage/workspaces - Get all workspaces summary for user
  static async getWorkspacesSummary(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const workspaces = await StorageService.getUserWorkspacesSummary(req.user.id);

      return res.json({
        success: true,
        data: workspaces,
      });
    } catch (error) {
      console.error('Get workspaces summary error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch workspaces summary',
      });
    }
  }

  // GET /api/storage/:workspaceId/overview - Get complete workspace storage overview
  static async getWorkspaceOverview(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;

      // Check if user is admin
      const isAdmin = await StorageService.isWorkspaceAdmin(req.user.id, workspaceId);

      const [storageInfo, breakdown, largestFiles, trend, fileTypes, myContribution] =
        await Promise.all([
          StorageService.getWorkspaceStorageInfo(workspaceId, req.user.id),
          StorageService.getWorkspaceStorageBreakdown(workspaceId, req.user.id),
          StorageService.getLargestFiles(workspaceId, req.user.id, 10),
          StorageService.getStorageTrend(workspaceId, req.user.id, 30),
          StorageService.getFileTypeBreakdown(workspaceId, req.user.id),
          StorageService.getMyContribution(workspaceId, req.user.id),
        ]);

      // Get user contributions if admin
      let userContributions = null;
      if (isAdmin) {
        userContributions = await StorageService.getUserContributions(
          workspaceId,
          req.user.id
        );
      }

      return res.json({
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
    } catch (error: any) {
      console.error('Get workspace overview error:', error);
      
      if (error.message === 'You do not have access to this workspace') {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch workspace storage overview',
      });
    }
  }

  // GET /api/storage/:workspaceId/info - Get workspace storage info
  static async getWorkspaceInfo(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const storageInfo = await StorageService.getWorkspaceStorageInfo(
        workspaceId,
        req.user.id
      );

      return res.json({
        success: true,
        data: storageInfo,
      });
    } catch (error: any) {
      console.error('Get workspace info error:', error);
      
      if (error.message.includes('access')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch workspace storage info',
      });
    }
  }

  // GET /api/storage/:workspaceId/my-contribution - Get current user's contribution
  static async getMyContribution(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const contribution = await StorageService.getMyContribution(workspaceId, req.user.id);

      return res.json({
        success: true,
        data: contribution,
      });
    } catch (error) {
      console.error('Get my contribution error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch your contribution',
      });
    }
  }

  // GET /api/storage/:workspaceId/user-contributions - Get all user contributions (admin only)
  static async getUserContributions(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const contributions = await StorageService.getUserContributions(
        workspaceId,
        req.user.id
      );

      return res.json({
        success: true,
        data: contributions,
      });
    } catch (error: any) {
      console.error('Get user contributions error:', error);
      
      if (error.message.includes('admin')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user contributions',
      });
    }
  }

  // GET /api/storage/:workspaceId/largest-files
  static async getLargestFiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const { limit } = req.query;

      const files = await StorageService.getLargestFiles(
        workspaceId,
        req.user.id,
        limit ? parseInt(limit as string) : 10
      );

      return res.json({
        success: true,
        data: files,
      });
    } catch (error) {
      console.error('Get largest files error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch largest files',
      });
    }
  }

  // POST /api/storage/:workspaceId/bulk-delete
  static async bulkDelete(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const { fileIds } = req.body;

      if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'File IDs array is required',
        });
      }

      const result = await StorageService.bulkDeleteFiles(
        fileIds,
        workspaceId,
        req.user.id
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message,
        });
      }

      return res.json({
        success: true,
        data: {
          deletedCount: result.deletedCount,
          freedMB: result.freedMB,
        },
        message: result.message,
      });
    } catch (error) {
      console.error('Bulk delete error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete files',
      });
    }
  }

  // POST /api/storage/:workspaceId/check-upload
  static async checkUpload(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { workspaceId } = req.params;
      const { fileSize } = req.body;

      if (!fileSize || typeof fileSize !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'File size is required',
        });
      }

      const result = await StorageService.canUploadFile(
        workspaceId,
        req.user.id,
        fileSize
      );

      return res.json({
        success: result.allowed,
        data: result,
        message: result.allowed ? 'Upload allowed' : result.reason,
      });
    } catch (error) {
      console.error('Check upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check upload',
      });
    }
  }
}