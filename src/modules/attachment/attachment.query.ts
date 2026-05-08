import { prisma } from "../../lib/prisma.js";
import { AttachmentAccess } from "./attachment.access.js";
import {
  getStorageInfo,
  seedWorkspaceStorageFromDb,
} from "./attatchment.quota.service.js";
import { bytesToMB } from "./attachment.utils.js";
import type { AttachmentStats } from "./attachment.types.js";
import { WorkspacePlan } from "./attachment.quota.types.js";

export const AttachmentQuery = {
  async getTaskAttachments(taskId: string, userId: string) {
    await AttachmentAccess.assertCanAttach(taskId, userId);

    return prisma.file.findMany({
      where:   { taskId },
      include: {
        uploadedBy: { select: { id: true, name: true, image: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });
  },

  async getWorkspaceAttachmentStats(
    workspaceId: string,
    userId:      string,
  ): Promise<AttachmentStats> {
    await AttachmentAccess.assertCanViewStats(workspaceId, userId);

    // Resolve plan for storage limits
    const ws = await prisma.workspace.findUnique({
      where:  { id: workspaceId },
      select: { plan: true } as any,
    });
    const plan = ((ws as any)?.plan ?? "FREE") as WorkspacePlan;

    // Seed storage counter if not yet cached
    const agg = await prisma.file.aggregate({
      where: { workspaceId },
      _sum:  { size: true },
    });
    await seedWorkspaceStorageFromDb(workspaceId, agg._sum.size ?? 0);

    // Storage info from Redis (single GET — no table scan)
    const storage = await getStorageInfo(workspaceId, plan);

    // Per-user breakdown still from DB (needed for the breakdown table)
    const files = await prisma.file.findMany({
      where:  { workspaceId },
      select: {
        size:       true,
        uploadedBy: { select: { id: true, name: true } },
      },
    });

    const userMap = new Map<string, { name: string; fileCount: number; totalSize: number }>();
    for (const file of files) {
      const existing = userMap.get(file.uploadedBy.id);
      if (existing) {
        existing.fileCount++;
        existing.totalSize += file.size;
      } else {
        userMap.set(file.uploadedBy.id, {
          name:      file.uploadedBy.name || "Unknown",
          fileCount: 1,
          totalSize: file.size,
        });
      }
    }

    const userUploads = Array.from(userMap.entries())
      .map(([uid, data]) => ({
        userId:      uid,
        userName:    data.name,
        fileCount:   data.fileCount,
        totalSizeMB: bytesToMB(data.totalSize),
      }))
      .sort((a, b) => b.fileCount - a.fileCount);

    return {
      totalFiles:      files.length,
      totalSizeMB:     bytesToMB(storage.usedBytes),
      // Extended storage fields for the frontend
      storage: {
        usedBytes:      storage.usedBytes,
        maxBytes:       storage.maxBytes,
        remainingBytes: storage.remainingBytes,
        usedPct:        storage.usedPct,
        usedFormatted:  storage.usedFormatted,
        maxFormatted:   storage.maxFormatted,
        isNearLimit:    storage.isNearLimit,
        isFull:         storage.isFull,
        plan,
        limits: {
          maxFileSizeMB:       storage.limits.maxFileSizeBytes / (1024 * 1024),
          maxDailyUploads:     storage.limits.maxDailyUploadsPerUser,
          uploadsPerMinute:    storage.limits.uploadsPerMinute,
          uploadsPerHour:      storage.limits.uploadsPerHour,
        },
      },
      userUploads,
    };
  },
};