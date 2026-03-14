// NOTE: This file is kept for reference only.
// The active upload validation is now handled by attachment.quota.service.ts
// which uses Redis-based atomic counters and sliding windows.
// This DB-based version is no longer called anywhere.

import { prisma } from '../../index.js';
import { getLimitsForPlan, bytesToMB, getTodayStart, getTodayEnd } from './attachment.utils.js';
import type { UploadLimits } from './attachment.types.js';

// Local result type — keeps limits and currentUsage fields this file needs
interface LegacyUploadCheckResult {
  allowed:       boolean;
  reason?:       string;
  limits?:       UploadLimits;
  currentUsage?: {
    todayCount:    number;
    lastUploadAt?: Date;
  };
}

export const AttachmentValidation = {
  async canUpload(
    userId:        string,
    workspaceId:   string,
    workspacePlan: string,
    fileSizeBytes: number,
  ): Promise<LegacyUploadCheckResult> {
    const limits     = getLimitsForPlan(workspacePlan);
    const fileSizeMB = bytesToMB(fileSizeBytes);

    if (fileSizeMB > limits.maxFileSizeMB) {
      return {
        allowed: false,
        reason:  `File size (${fileSizeMB}MB) exceeds ${limits.maxFileSizeMB}MB limit for ${workspacePlan} plan`,
        limits,
      };
    }

    const todayStart   = getTodayStart();
    const todayEnd     = getTodayEnd();
    const todayUploads = await prisma.file.count({
      where: {
        uploadedById: userId,
        workspaceId,
        uploadedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    const dailyMax = limits.maxDailyUploads ?? Infinity;

    if (todayUploads >= dailyMax) {
      return {
        allowed: false,
        reason:  `Daily upload limit reached (${todayUploads}/${dailyMax} for ${workspacePlan} plan)`,
        limits,
        currentUsage: { todayCount: todayUploads },
      };
    }

    if (limits.minUploadIntervalSeconds > 0) {
      const lastUpload = await prisma.file.findFirst({
        where:   { uploadedById: userId, workspaceId },
        orderBy: { uploadedAt: 'desc' },
        select:  { uploadedAt: true },
      });

      if (lastUpload) {
        const secondsSince = (Date.now() - lastUpload.uploadedAt.getTime()) / 1000;
        if (secondsSince < limits.minUploadIntervalSeconds) {
          const waitSeconds = Math.ceil(limits.minUploadIntervalSeconds - secondsSince);
          return {
            allowed: false,
            reason:  `Please wait ${waitSeconds} seconds before uploading again`,
            limits,
            currentUsage: { todayCount: todayUploads, lastUploadAt: lastUpload.uploadedAt },
          };
        }
      }
    }

    return {
      allowed:      true,
      limits,
      currentUsage: { todayCount: todayUploads },
    };
  },
};