import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { StorageService } from '../services/storage.service.js';
import { prisma } from '../index.js';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// GET /api/files - Get user's uploaded files
export const getUserFiles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const { workspaceId, projectId, taskId, folder } = req.query;

    const whereClause: Record<string, unknown> = {
      uploadedById: req.user.id,
    };

    if (workspaceId) whereClause.workspaceId = workspaceId;
    if (projectId) whereClause.projectId = projectId;
    if (taskId) whereClause.taskId = taskId;
    if (folder) whereClause.folder = folder;

    const files = await prisma.file.findMany({
      where: whereClause,
      orderBy: {
        uploadedAt: 'desc',
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    // Get storage info
    const storageInfo = await StorageService.getStorageInfo(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        files,
        count: files.length,
      },
      storageInfo,
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve files',
    });
  }
};

// DELETE /api/files/:id - Delete a file
export const deleteFile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const { id } = req.params;

    // Get file info before deletion
    const file = await prisma.file.findUnique({
      where: { id },
      select: {
        uploadedById: true,
        name: true,
        url: true,
      },
    });

    if (!file) {
      res.status(404).json({
        success: false,
        message: 'File not found',
      });
      return;
    }

    // Delete using StorageService (handles authorization and storage tracking)
    const result = await StorageService.deleteFile(id, req.user.id);

    if (!result.success) {
      res.status(403).json({
        success: false,
        message: result.message,
      });
      return;
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(file.name);
    } catch (cloudinaryError) {
      console.error('Cloudinary deletion error:', cloudinaryError);
      // Continue even if Cloudinary deletion fails
    }

    // Get updated storage info
    const storageInfo = await StorageService.getStorageInfo(req.user.id);

    res.status(200).json({
      success: true,
      message: result.message,
      freedMB: result.freedMB,
      storageInfo,
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
    });
  }
};
