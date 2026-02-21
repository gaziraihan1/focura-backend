/**
 * attachment.query.ts
 * Responsibility: Read-only operations for attachments.
 */

import { prisma } from '../../index.js';
import { AttachmentAccess } from './attachment.access.js';
import { bytesToMB } from './attachment.utils.js';
import type { AttachmentStats } from './attachment.types.js';

export const AttachmentQuery = {
  /**
   * Returns all attachments for a task.
   * Includes uploader info and file metadata.
   */
  async getTaskAttachments(taskId: string, userId: string) {
    // Verify user can access this task
    await AttachmentAccess.assertCanAttach(taskId, userId);

    return prisma.file.findMany({
      where: { taskId },
      include: {
        uploadedBy: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    });
  },

  /**
   * Returns attachment statistics for a workspace.
   * Shows per-user upload counts and sizes.
   * Only accessible to workspace OWNER/ADMIN.
   */
  async getWorkspaceAttachmentStats(
    workspaceId: string,
    userId: string,
  ): Promise<AttachmentStats> {
    await AttachmentAccess.assertCanViewStats(workspaceId, userId);

    // Get all files with uploader info
    const files = await prisma.file.findMany({
      where: { workspaceId },
      select: {
        size: true,
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Aggregate by user
    const userMap = new Map<string, { name: string; fileCount: number; totalSize: number }>();

    for (const file of files) {
      const existing = userMap.get(file.uploadedBy.id);
      if (existing) {
        existing.fileCount++;
        existing.totalSize += file.size;
      } else {
        userMap.set(file.uploadedBy.id, {
          name: file.uploadedBy.name || 'Unknown',
          fileCount: 1,
          totalSize: file.size,
        });
      }
    }

    const userUploads = Array.from(userMap.entries()).map(([userId, data]) => ({
      userId,
      userName: data.name,
      fileCount: data.fileCount,
      totalSizeMB: bytesToMB(data.totalSize),
    }));

    // Sort by file count descending
    userUploads.sort((a, b) => b.fileCount - a.fileCount);

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    return {
      totalFiles: files.length,
      totalSizeMB: bytesToMB(totalSize),
      userUploads,
    };
  },
};