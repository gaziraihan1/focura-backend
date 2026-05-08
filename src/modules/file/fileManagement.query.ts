
import { prisma } from '../../lib/prisma.js';
import { FileManagementAccess } from './fileManagement.access.js';
import { buildFileWhereClause, buildFileOrderBy } from './fileManagement.filters.js';
import { bytesToMB, categorizeFileType } from './fileManagement.utils.js';
import type {
  FileFilters,
  FileListResult,
  FileTypeStats,
  UploaderInfo,
} from './fileManagement.types.js';

export const FileManagementQuery = {
  async getFiles(
    workspaceId: string,
    userId: string,
    filters?: FileFilters,
    page: number = 1,
    limit: number = 50
  ): Promise<FileListResult> {
    await FileManagementAccess.assertWorkspaceMember(userId, workspaceId);
    const isAdmin = await FileManagementAccess.isWorkspaceAdmin(userId, workspaceId);

    const where = buildFileWhereClause(workspaceId, isAdmin, userId, filters);
    const orderBy = buildFileOrderBy(filters);

    const [total, files] = await Promise.all([
      prisma.file.count({ where }),
      prisma.file.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          originalName: true,
          size: true,
          mimeType: true,
          url: true,
          uploadedAt: true,
          folder: true,
          uploadedBy: {
            select: { id: true, name: true, email: true, image: true },
          },
          task: {
            select: { id: true, title: true },
          },
          project: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    return {
      files: files.map((file) => ({
        ...file,
        sizeMB: bytesToMB(file.size),
      })),
      total,
      hasMore: total > page * limit,
      isAdmin,
    };
  },

  async getFileTypeStats(workspaceId: string, userId: string): Promise<FileTypeStats[]> {
    await FileManagementAccess.assertWorkspaceMember(userId, workspaceId);
    const isAdmin = await FileManagementAccess.isWorkspaceAdmin(userId, workspaceId);

    const where: any = { workspaceId };
    if (!isAdmin) {
      where.uploadedById = userId;
    }

    const files = await prisma.file.findMany({
      where,
      select: { mimeType: true, size: true },
    });

    const typeMap: Record<string, { count: number; size: number }> = {};

    files.forEach((file) => {
      const category = categorizeFileType(file.mimeType);
      if (!typeMap[category]) {
        typeMap[category] = { count: 0, size: 0 };
      }
      typeMap[category].count += 1;
      typeMap[category].size += file.size;
    });

    return Object.entries(typeMap).map(([type, data]) => ({
      type,
      count: data.count,
      sizeMB: bytesToMB(data.size),
    }));
  },

  async getUploaders(workspaceId: string, userId: string): Promise<UploaderInfo[]> {
    await FileManagementAccess.assertWorkspaceMember(userId, workspaceId);
    const isAdmin = await FileManagementAccess.isWorkspaceAdmin(userId, workspaceId);

    if (!isAdmin) {
      return [];
    }

    const uploaders = await prisma.file.groupBy({
      by: ['uploadedById'],
      where: { workspaceId },
      _count: { uploadedById: true },
    });

    const uploaderIds = uploaders.map((u) => u.uploadedById);
    const users = await prisma.user.findMany({
      where: { id: { in: uploaderIds } },
      select: { id: true, name: true, email: true },
    });

    return uploaders.map((uploader) => {
      const user = users.find((u) => u.id === uploader.uploadedById);
      return {
        id: uploader.uploadedById,
        name: user?.name || null,
        email: user?.email || 'Unknown',
        fileCount: uploader._count.uploadedById,
      };
    });
  },
};