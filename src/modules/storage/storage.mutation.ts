
import { prisma } from '../../index.js';
import type { BulkDeleteResult, UploadCheckResult } from './storage.types.js';
import { StorageAccess } from './storage.access.js';
import { StorageQuery }  from './storage.query.js';
import { toMB, getMaxFileSizeForPlan } from './storage.utils.js';

export const StorageMutation = {
  async bulkDeleteFiles(
    fileIds:     string[],
    workspaceId: string,
    userId:      string,
  ): Promise<BulkDeleteResult & { success: boolean; message: string }> {
    const isAdmin = await StorageAccess.isAdmin(userId, workspaceId);

    const files = await prisma.file.findMany({
      where:  { id: { in: fileIds }, workspaceId },
      select: { id: true, size: true, uploadedById: true },
    });

    if (files.length === 0) {
      return { success: false, message: 'No files found in this workspace', deletedCount: 0, freedMB: 0 };
    }

    const deletable = files.filter((f) => f.uploadedById === userId || isAdmin);

    if (deletable.length === 0) {
      return { success: false, message: 'You do not have permission to delete these files', deletedCount: 0, freedMB: 0 };
    }

    const totalSize = deletable.reduce((sum, f) => sum + f.size, 0);

    await prisma.file.deleteMany({
      where: { id: { in: deletable.map((f) => f.id) } },
    });

    return {
      success:      true,
      message:      `${deletable.length} file(s) deleted successfully`,
      deletedCount: deletable.length,
      freedMB:      toMB(totalSize),
    };
  },

    async deleteFile(
    fileId: string,
    userId: string,
  ): Promise<{ success: boolean; message: string; freedMB: number }> {
    const file = await prisma.file.findFirst({
      where: { id: fileId },
      select: {
        id: true,
        size: true,
        uploadedById: true,
        workspaceId: true,
        workspace: {
          select: {
            members: {
              where: { userId },
              select: { role: true },
            },
          },
        },
      },
    });

    if (!file) {
      return { success: false, message: 'File not found', freedMB: 0 };
    }

    const isOwner = file.uploadedById === userId;
    const isAdmin = file.workspace?.members[0]?.role === 'OWNER' ||
                    file.workspace?.members[0]?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return {
        success: false,
        message: 'You do not have permission to delete this file',
        freedMB: 0,
      };
    }

    await prisma.file.delete({ where: { id: fileId } });

    return {
      success: true,
      message: 'File deleted successfully',
      freedMB: toMB(file.size),
    };
  },

  async canUploadFile(
    workspaceId:   string,
    userId:        string,
    fileSizeBytes: number,
  ): Promise<UploadCheckResult> {
    const storageInfo = await StorageQuery.getWorkspaceStorageInfo(workspaceId, userId);
    const fileSizeMB  = fileSizeBytes / (1024 * 1024);

    if (storageInfo.usedMB + fileSizeMB > storageInfo.totalMB) {
      return {
        allowed: false,
        reason:  `Storage limit exceeded. Workspace has ${storageInfo.remainingMB.toFixed(2)} MB remaining.`,
      };
    }

    const maxFileSizeMB = getMaxFileSizeForPlan(storageInfo.plan);
    if (fileSizeMB > maxFileSizeMB) {
      return {
        allowed: false,
        reason:  `File size exceeds ${maxFileSizeMB} MB limit for ${storageInfo.plan} plan.`,
      };
    }

    return { allowed: true };
  },

  async recordFileUpload(params: {
    userId:       string;
    workspaceId:  string;
    name:         string;
    originalName: string;
    size:         number;
    mimeType:     string;
    url:          string;
    thumbnail?:   string;
    folder?:      string;
    projectId?:   string;
    taskId?:      string;
  }) {
    await StorageAccess.assertMember(params.userId, params.workspaceId);

    return prisma.file.create({
      data: {
        name:         params.name,
        originalName: params.originalName,
        size:         params.size,
        mimeType:     params.mimeType,
        url:          params.url,
        thumbnail:    params.thumbnail,
        folder:       params.folder,
        uploadedById: params.userId,
        workspaceId:  params.workspaceId,
        projectId:    params.projectId,
        taskId:       params.taskId,
      },
    });
  },
};