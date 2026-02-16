// services/storage.service.ts
import { prisma } from '../index.js';
import { Prisma } from '@prisma/client';

interface StorageInfo {
  usedMB: number;
  totalMB: number;
  remainingMB: number;
  percentage: number;
  plan: string;
  workspaceId: string;
  workspaceName: string;
}

interface UserStorageContribution {
  userId: string;
  userName: string | null;
  userEmail: string;
  usageMB: number;
  fileCount: number;
  percentage: number;
}

interface StorageBreakdown {
  attachments: number;
  workspaceFiles: number;
  projectFiles: number;
  total: number;
}

interface LargestFile {
  id: string;
  name: string;
  originalName: string;
  size: number;
  sizeMB: number;
  mimeType: string;
  url: string;
  uploadedAt: Date;
  uploadedBy: {
    id: string;
    name: string | null;
    email: string;
  };
  task: {
    id: string;
    title: string;
  } | null;
  project: {
    id: string;
    name: string;
  } | null;
}

interface StorageTrend {
  date: Date;
  usageMB: number;
}

interface FileTypeBreakdown {
  mimeType: string;
  category: string;
  count: number;
  sizeMB: number;
}

interface WorkspaceSummary {
  workspaceId: string;
  workspaceName: string;
  plan: string;
  usageMB: number;
  totalMB: number;
  remainingMB: number;
  percentage: number;
  role: string;
  fileCount: number;
}

export class StorageService {
  // Get user's role in workspace
  static async getUserRole(userId: string, workspaceId: string): Promise<string | null> {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
      select: {
        role: true,
      },
    });

    return member?.role || null;
  }

  // Check if user is workspace owner or admin
  static async isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
    const role = await this.getUserRole(userId, workspaceId);
    return role === 'OWNER' || role === 'ADMIN';
  }

  // Get workspace storage info
  static async getWorkspaceStorageInfo(
    workspaceId: string,
    userId: string
  ): Promise<StorageInfo> {
    // Verify user has access to workspace
    const member = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!member) {
      throw new Error('You do not have access to this workspace');
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        plan: true,
        maxStorage: true,
      },
    });

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    // Calculate total storage used in workspace
    const files = await prisma.file.findMany({
      where: { workspaceId },
      select: { size: true },
    });

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const usedMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
    const totalMB = workspace.maxStorage;
    const remainingMB = Math.max(0, totalMB - usedMB);
    const percentage = Math.min(100, Math.round((usedMB / totalMB) * 100));

    return {
      usedMB,
      totalMB,
      remainingMB,
      percentage,
      plan: workspace.plan,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    };
  }

  // Get storage breakdown for workspace
  static async getWorkspaceStorageBreakdown(
    workspaceId: string,
    userId: string
  ): Promise<StorageBreakdown> {
    // Verify access
    await this.getUserRole(userId, workspaceId);

    const files = await prisma.file.findMany({
      where: { workspaceId },
      select: {
        size: true,
        taskId: true,
        projectId: true,
      },
    });

    let attachments = 0;
    let workspaceFiles = 0;
    let projectFiles = 0;

    files.forEach((file) => {
      const sizeMB = file.size / (1024 * 1024);

      if (file.taskId) {
        attachments += sizeMB;
      } else if (file.projectId) {
        projectFiles += sizeMB;
      } else {
        workspaceFiles += sizeMB;
      }
    });

    return {
      attachments: Math.round(attachments * 100) / 100,
      workspaceFiles: Math.round(workspaceFiles * 100) / 100,
      projectFiles: Math.round(projectFiles * 100) / 100,
      total: Math.round((attachments + workspaceFiles + projectFiles) * 100) / 100,
    };
  }

  // Get user contributions to workspace storage (admin only)
  static async getUserContributions(
    workspaceId: string,
    requestingUserId: string
  ): Promise<UserStorageContribution[]> {
    // Verify admin access
    const isAdmin = await this.isWorkspaceAdmin(requestingUserId, workspaceId);
    if (!isAdmin) {
      throw new Error('Only workspace owners and admins can view user contributions');
    }

    const files = await prisma.file.findMany({
      where: { workspaceId },
      select: {
        size: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Calculate total workspace storage
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const totalMB = totalBytes / (1024 * 1024);

    // Group by user
    const userMap = new Map<
      string,
      { name: string | null; email: string; size: number; count: number }
    >();

    files.forEach((file) => {
      const userId = file.uploadedBy.id;
      const existing = userMap.get(userId) || {
        name: file.uploadedBy.name,
        email: file.uploadedBy.email,
        size: 0,
        count: 0,
      };
      existing.size += file.size;
      existing.count += 1;
      userMap.set(userId, existing);
    });

    return Array.from(userMap.entries())
      .map(([userId, data]) => {
        const usageMB = Math.round((data.size / (1024 * 1024)) * 100) / 100;
        return {
          userId,
          userName: data.name,
          userEmail: data.email,
          usageMB,
          fileCount: data.count,
          percentage: totalMB > 0 ? Math.round((usageMB / totalMB) * 100) : 0,
        };
      })
      .sort((a, b) => b.usageMB - a.usageMB);
  }

  // Get current user's contribution to workspace
  static async getMyContribution(
    workspaceId: string,
    userId: string
  ): Promise<{ usageMB: number; fileCount: number; percentage: number }> {
    // Verify access
    await this.getUserRole(userId, workspaceId);

    const userFiles = await prisma.file.findMany({
      where: {
        workspaceId,
        uploadedById: userId,
      },
      select: { size: true },
    });

    const allFiles = await prisma.file.findMany({
      where: { workspaceId },
      select: { size: true },
    });

    const userBytes = userFiles.reduce((sum, file) => sum + file.size, 0);
    const totalBytes = allFiles.reduce((sum, file) => sum + file.size, 0);

    const usageMB = Math.round((userBytes / (1024 * 1024)) * 100) / 100;
    const totalMB = totalBytes / (1024 * 1024);

    return {
      usageMB,
      fileCount: userFiles.length,
      percentage: totalMB > 0 ? Math.round((usageMB / totalMB) * 100) : 0,
    };
  }

  // Get largest files in workspace
  static async getLargestFiles(
    workspaceId: string,
    userId: string,
    limit: number = 10
  ): Promise<LargestFile[]> {
    // Verify access
    await this.getUserRole(userId, workspaceId);

    const files = await prisma.file.findMany({
      where: { workspaceId },
      orderBy: { size: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        originalName: true,
        size: true,
        mimeType: true,
        url: true,
        uploadedAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return files.map((file) => ({
      ...file,
      sizeMB: Math.round((file.size / (1024 * 1024)) * 100) / 100,
    }));
  }

  // Get storage trend for workspace
  static async getStorageTrend(
    workspaceId: string,
    userId: string,
    days: number = 30
  ): Promise<StorageTrend[]> {
    // Verify access
    await this.getUserRole(userId, workspaceId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const files = await prisma.file.findMany({
      where: {
        workspaceId,
        uploadedAt: { gte: startDate },
      },
      select: {
        uploadedAt: true,
        size: true,
      },
      orderBy: { uploadedAt: 'asc' },
    });

    const initialFiles = await prisma.file.findMany({
      where: {
        workspaceId,
        uploadedAt: { lt: startDate },
      },
      select: { size: true },
    });

    let cumulativeSize = initialFiles.reduce((sum, file) => sum + file.size, 0);
    const trendMap = new Map<string, number>();

    files.forEach((file) => {
      cumulativeSize += file.size;
      const dateKey = file.uploadedAt.toISOString().split('T')[0];
      trendMap.set(dateKey, cumulativeSize);
    });

    const trend: StorageTrend[] = [];
    let currentSize = initialFiles.reduce((sum, file) => sum + file.size, 0);

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const dateKey = date.toISOString().split('T')[0];

      if (trendMap.has(dateKey)) {
        currentSize = trendMap.get(dateKey)!;
      }

      trend.push({
        date: new Date(dateKey),
        usageMB: Math.round((currentSize / (1024 * 1024)) * 100) / 100,
      });
    }

    return trend;
  }

  // Get file type breakdown for workspace
  static async getFileTypeBreakdown(
    workspaceId: string,
    userId: string
  ): Promise<FileTypeBreakdown[]> {
    // Verify access
    await this.getUserRole(userId, workspaceId);

    const files = await prisma.file.findMany({
      where: { workspaceId },
      select: {
        mimeType: true,
        size: true,
      },
    });

    const typeMap = new Map<string, { count: number; size: number }>();

    files.forEach((file) => {
      const existing = typeMap.get(file.mimeType) || { count: 0, size: 0 };
      existing.count += 1;
      existing.size += file.size;
      typeMap.set(file.mimeType, existing);
    });

    return Array.from(typeMap.entries())
      .map(([mimeType, data]) => ({
        mimeType,
        category: this.getCategoryFromMimeType(mimeType),
        count: data.count,
        sizeMB: Math.round((data.size / (1024 * 1024)) * 100) / 100,
      }))
      .sort((a, b) => b.sizeMB - a.sizeMB);
  }

  // Get all workspaces summary for user
  static async getUserWorkspacesSummary(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await prisma.workspaceMember.findMany({
      where: { 
        userId,
        workspaceId: { not: null }, // Filter out null workspaces
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            plan: true,
            maxStorage: true,
          },
        },
      },
    });

    // Filter out any memberships where workspace is null (shouldn't happen with the query above)
    const validMemberships = memberships.filter((m) => m.workspace !== null);

    const summaries = await Promise.all(
      validMemberships.map(async (membership) => {
        const workspace = membership.workspace!;

        const files = await prisma.file.findMany({
          where: { workspaceId: workspace.id },
          select: { size: true },
        });

        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        const usageMB = Math.round((totalBytes / (1024 * 1024)) * 100) / 100;
        const totalMB = workspace.maxStorage;
        const remainingMB = Math.max(0, totalMB - usageMB);
        const percentage = Math.min(100, Math.round((usageMB / totalMB) * 100));

        return {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          plan: workspace.plan,
          usageMB,
          totalMB,
          remainingMB,
          percentage,
          role: membership.role,
          fileCount: files.length,
        };
      })
    );

    return summaries.sort((a, b) => b.usageMB - a.usageMB);
  }

  // Bulk delete files in workspace
  static async bulkDeleteFiles(
    fileIds: string[],
    workspaceId: string,
    userId: string
  ): Promise<{ success: boolean; message: string; deletedCount: number; freedMB: number }> {
    // Check if user is admin
    const isAdmin = await this.isWorkspaceAdmin(userId, workspaceId);

    // Get files to verify workspace and ownership
    const files = await prisma.file.findMany({
      where: {
        id: { in: fileIds },
        workspaceId, // Must be in the specified workspace
      },
      select: {
        id: true,
        size: true,
        uploadedById: true,
      },
    });

    if (files.length === 0) {
      return {
        success: false,
        message: 'No files found in this workspace',
        deletedCount: 0,
        freedMB: 0,
      };
    }

    // Filter files user can delete (own files or admin)
    const deletableFiles = files.filter(
      (file) => file.uploadedById === userId || isAdmin
    );

    if (deletableFiles.length === 0) {
      return {
        success: false,
        message: 'You do not have permission to delete these files',
        deletedCount: 0,
        freedMB: 0,
      };
    }

    const totalSize = deletableFiles.reduce((sum, file) => sum + file.size, 0);
    const fileIdsToDelete = deletableFiles.map((f) => f.id);

    await prisma.file.deleteMany({
      where: { id: { in: fileIdsToDelete } },
    });

    const freedMB = Math.round((totalSize / (1024 * 1024)) * 100) / 100;

    return {
      success: true,
      message: `${deletableFiles.length} file(s) deleted successfully`,
      deletedCount: deletableFiles.length,
      freedMB,
    };
  }

  // Check if workspace can upload file
  static async canUploadFile(
    workspaceId: string,
    userId: string,
    fileSizeBytes: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Verify user has access
    await this.getUserRole(userId, workspaceId);

    const storageInfo = await this.getWorkspaceStorageInfo(workspaceId, userId);
    const fileSizeMB = fileSizeBytes / (1024 * 1024);

    if (storageInfo.usedMB + fileSizeMB > storageInfo.totalMB) {
      return {
        allowed: false,
        reason: `Storage limit exceeded. Workspace has ${storageInfo.remainingMB.toFixed(2)} MB remaining.`,
      };
    }

    const maxFileSizeMB = this.getMaxFileSizeForPlan(storageInfo.plan);
    if (fileSizeMB > maxFileSizeMB) {
      return {
        allowed: false,
        reason: `File size exceeds ${maxFileSizeMB} MB limit for ${storageInfo.plan} plan.`,
      };
    }

    return { allowed: true };
  }

  private static getMaxFileSizeForPlan(plan: string): number {
    const limits: Record<string, number> = {
      FREE: 5,
      PRO: 25,
      BUSINESS: 100,
      ENTERPRISE: 500,
    };
    return limits[plan] || 5;
  }

  private static getCategoryFromMimeType(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'Images';
    if (mimeType.startsWith('video/')) return 'Videos';
    if (mimeType.includes('pdf')) return 'PDFs';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Documents';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'Spreadsheets';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
      return 'Presentations';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archives';
    return 'Other';
  }
}