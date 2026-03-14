import { prisma } from '../../index.js';
import type {
  StorageInfo,
  StorageBreakdown,
  UserStorageContribution,
  MyContribution,
  LargestFile,
  StorageTrend,
  FileTypeBreakdown,
  WorkspaceSummary,
} from './storage.types.js';
import { StorageAccess } from './storage.access.js';
import { toMB, getCategoryFromMimeType } from './storage.utils.js';
import {
  getWorkspaceStorageBytes,
  seedWorkspaceStorageFromDb,
} from '../attachment/attatchment.quota.service.js';

// ─── Seed helper ──────────────────────────────────────────────────────────────

async function ensureStorageSeeded(workspaceId: string): Promise<void> {
  const agg = await prisma.file.aggregate({
    where: { workspaceId },
    _sum:  { size: true },
  });
  await seedWorkspaceStorageFromDb(workspaceId, agg._sum.size ?? 0);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const StorageQuery = {
  async getWorkspaceStorageInfo(workspaceId: string, userId: string): Promise<StorageInfo> {
    // Single query — gets role + workspace data together
    const { workspace } = await StorageAccess.assertMemberWithWorkspace(userId, workspaceId);

    // Seed on cache miss then read from Redis — avoids aggregate on every request
    await ensureStorageSeeded(workspaceId);
    const usedBytes   = await getWorkspaceStorageBytes(workspaceId);
    const usedMB      = toMB(usedBytes);
    const totalMB     = workspace.maxStorage;
    const remainingMB = Math.max(0, totalMB - usedMB);
    const percentage  = Math.min(100, Math.round((usedMB / totalMB) * 100));

    return {
      usedMB,
      totalMB,
      remainingMB,
      percentage,
      plan:          workspace.plan,
      workspaceId:   workspace.id,
      workspaceName: workspace.name,
    };
  },

  async getWorkspaceStorageBreakdown(workspaceId: string, userId: string): Promise<StorageBreakdown> {
    await StorageAccess.assertMember(userId, workspaceId);

    const files = await prisma.file.findMany({
      where:  { workspaceId },
      select: { size: true, taskId: true, projectId: true },
    });

    let attachments    = 0;
    let workspaceFiles = 0;
    let projectFiles   = 0;

    for (const file of files) {
      const mb = file.size / (1024 * 1024);
      if      (file.taskId)    attachments    += mb;
      else if (file.projectId) projectFiles   += mb;
      else                     workspaceFiles += mb;
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      attachments:    round(attachments),
      workspaceFiles: round(workspaceFiles),
      projectFiles:   round(projectFiles),
      total:          round(attachments + workspaceFiles + projectFiles),
    };
  },

  async getUserContributions(
    workspaceId:      string,
    requestingUserId: string,
  ): Promise<UserStorageContribution[]> {
    await StorageAccess.assertAdmin(requestingUserId, workspaceId);

    const files = await prisma.file.findMany({
      where:  { workspaceId },
      select: {
        size:       true,
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    const totalMB    = totalBytes / (1024 * 1024);

    const userMap = new Map<
      string,
      { name: string | null; email: string; size: number; count: number }
    >();

    for (const file of files) {
      const uid      = file.uploadedBy.id;
      const existing = userMap.get(uid) ?? {
        name:  file.uploadedBy.name,
        email: file.uploadedBy.email,
        size:  0,
        count: 0,
      };
      existing.size  += file.size;
      existing.count += 1;
      userMap.set(uid, existing);
    }

    return Array.from(userMap.entries())
      .map(([userId, data]) => {
        const usageMB = toMB(data.size);
        return {
          userId,
          userName:   data.name,
          userEmail:  data.email,
          usageMB,
          fileCount:  data.count,
          percentage: totalMB > 0 ? Math.round((usageMB / totalMB) * 100) : 0,
        };
      })
      .sort((a, b) => b.usageMB - a.usageMB);
  },

  async getMyContribution(workspaceId: string, userId: string): Promise<MyContribution> {
    await StorageAccess.assertMember(userId, workspaceId);

    const [userAgg, totalAgg] = await Promise.all([
      prisma.file.aggregate({
        where:  { workspaceId, uploadedById: userId },
        _sum:   { size: true },
        _count: { id: true },
      }),
      prisma.file.aggregate({
        where: { workspaceId },
        _sum:  { size: true },
      }),
    ]);

    const userBytes  = userAgg._sum.size  ?? 0;
    const totalBytes = totalAgg._sum.size ?? 0;
    const usageMB    = toMB(userBytes);
    const totalMB    = totalBytes / (1024 * 1024);

    return {
      usageMB,
      fileCount:  userAgg._count.id,
      percentage: totalMB > 0 ? Math.round((usageMB / totalMB) * 100) : 0,
    };
  },

  async getLargestFiles(
    workspaceId: string,
    userId:      string,
    limit = 10,
  ): Promise<LargestFile[]> {
    await StorageAccess.assertMember(userId, workspaceId);

    const files = await prisma.file.findMany({
      where:   { workspaceId },
      orderBy: { size: 'desc' },
      take:    limit,
      select: {
        id: true, name: true, originalName: true,
        size: true, mimeType: true, url: true, uploadedAt: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
        task:       { select: { id: true, title: true } },
        project:    { select: { id: true, name: true  } },
      },
    });

    return files.map((file) => ({ ...file, sizeMB: toMB(file.size) }));
  },

  async getStorageTrend(
    workspaceId: string,
    userId:      string,
    days = 30,
  ): Promise<StorageTrend[]> {
    await StorageAccess.assertMember(userId, workspaceId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [recentFiles, baselineAgg] = await Promise.all([
      prisma.file.findMany({
        where:   { workspaceId, uploadedAt: { gte: startDate } },
        select:  { uploadedAt: true, size: true },
        orderBy: { uploadedAt: 'asc' },
      }),
      prisma.file.aggregate({
        where: { workspaceId, uploadedAt: { lt: startDate } },
        _sum:  { size: true },
      }),
    ]);

    let cumulative = baselineAgg._sum.size ?? 0;
    const trendMap = new Map<string, number>();

    for (const file of recentFiles) {
      cumulative += file.size;
      const key = file.uploadedAt.toISOString().split('T')[0];
      trendMap.set(key, cumulative);
    }

    const trend: StorageTrend[] = [];
    let currentSize = baselineAgg._sum.size ?? 0;

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i - 1));
      const key = date.toISOString().split('T')[0];
      if (trendMap.has(key)) currentSize = trendMap.get(key)!;
      trend.push({ date: new Date(key), usageMB: toMB(currentSize) });
    }

    return trend;
  },

  async getFileTypeBreakdown(workspaceId: string, userId: string): Promise<FileTypeBreakdown[]> {
    await StorageAccess.assertMember(userId, workspaceId);

    const files = await prisma.file.findMany({
      where:  { workspaceId },
      select: { mimeType: true, size: true },
    });

    const typeMap = new Map<string, { count: number; size: number }>();

    for (const file of files) {
      const entry = typeMap.get(file.mimeType) ?? { count: 0, size: 0 };
      entry.count += 1;
      entry.size  += file.size;
      typeMap.set(file.mimeType, entry);
    }

    return Array.from(typeMap.entries())
      .map(([mimeType, data]) => ({
        mimeType,
        category: getCategoryFromMimeType(mimeType),
        count:    data.count,
        sizeMB:   toMB(data.size),
      }))
      .sort((a, b) => b.sizeMB - a.sizeMB);
  },

  async getUserWorkspacesSummary(userId: string): Promise<WorkspaceSummary[]> {
    const [memberships, fileSizesByWorkspace] = await Promise.all([
      prisma.workspaceMember.findMany({
        where:   { userId },
        include: {
          workspace: {
            select: { id: true, name: true, plan: true, maxStorage: true },
          },
        },
      }),
      prisma.file.groupBy({
        by:     ['workspaceId'],
        _sum:   { size: true },
        _count: { id: true },
      }),
    ]);

    // Seed all workspace counters in parallel (NX — no-op if already seeded)
    const sizeMap = new Map(
      fileSizesByWorkspace.map((row) => [
        row.workspaceId,
        { totalBytes: row._sum.size ?? 0, fileCount: row._count.id },
      ]),
    );

    await Promise.allSettled(
      memberships
        .filter((m) => m.workspace !== null)
        .map((m) =>
          seedWorkspaceStorageFromDb(m.workspace!.id, sizeMap.get(m.workspace!.id)?.totalBytes ?? 0),
        ),
    );

    return memberships
      .filter((m) => m.workspace !== null)
      .map((membership) => {
        const workspace = membership.workspace!;
        const { totalBytes = 0, fileCount = 0 } = sizeMap.get(workspace.id) ?? {};

        const usedMB      = toMB(totalBytes);
        const totalMB     = workspace.maxStorage;
        const remainingMB = Math.max(0, totalMB - usedMB);
        const percentage  = Math.min(100, Math.round((usedMB / totalMB) * 100));

        return {
          workspaceId:   workspace.id,
          workspaceName: workspace.name,
          plan:          workspace.plan,
          usageMB:       usedMB,
          totalMB,
          remainingMB,
          percentage,
          role:          membership.role,
          fileCount,
        };
      })
      .sort((a, b) => b.usageMB - a.usageMB);
  },
};