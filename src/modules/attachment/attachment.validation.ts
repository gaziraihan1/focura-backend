/**
 * attachment.validation.ts
 * Responsibility: Tier-based upload validation and rate limiting.
 */

import { prisma } from '../../index.js';
import { getLimitsForPlan, bytesToMB, getTodayStart, getTodayEnd } from './attachment.utils.js';
import type { UploadCheckResult } from './attachment.types.js';

export const AttachmentValidation = {
  /**
   * Comprehensive upload validation checking all tier-based limits:
   *  1. File size limit
   *  2. Daily upload count limit
   *  3. Rate limiting (time between uploads)
   */
  async canUpload(
    userId: string,
    workspaceId: string,
    workspacePlan: string,
    fileSizeBytes: number,
  ): Promise<UploadCheckResult> {
    const limits = getLimitsForPlan(workspacePlan);
    const fileSizeMB = bytesToMB(fileSizeBytes);

    // Check 1: File size limit
    if (fileSizeMB > limits.maxFileSizeMB) {
      return {
        allowed: false,
        reason: `File size (${fileSizeMB}MB) exceeds ${limits.maxFileSizeMB}MB limit for ${workspacePlan} plan`,
        limits,
      };
    }

    const todayStart = getTodayStart();
    const todayEnd = getTodayEnd();

    // Check 2: Daily upload count
    const todayUploads = await prisma.file.count({
      where: {
        uploadedById: userId,
        workspaceId,
        uploadedAt: { gte: todayStart, lte: todayEnd },
      },
    });

    if (todayUploads >= limits.maxDailyUploads) {
      return {
        allowed: false,
        reason: `Daily upload limit reached (${todayUploads}/${limits.maxDailyUploads} for ${workspacePlan} plan)`,
        limits,
        currentUsage: { todayCount: todayUploads },
      };
    }

    // Check 3: Rate limiting (FREE tier only)
    if (limits.minUploadIntervalSeconds > 0) {
      const lastUpload = await prisma.file.findFirst({
        where: { uploadedById: userId, workspaceId },
        orderBy: { uploadedAt: 'desc' },
        select: { uploadedAt: true },
      });

      if (lastUpload) {
        const secondsSinceLastUpload = (Date.now() - lastUpload.uploadedAt.getTime()) / 1000;

        if (secondsSinceLastUpload < limits.minUploadIntervalSeconds) {
          const waitSeconds = Math.ceil(limits.minUploadIntervalSeconds - secondsSinceLastUpload);
          return {
            allowed: false,
            reason: `Please wait ${waitSeconds} seconds before uploading again (FREE plan rate limit)`,
            limits,
            currentUsage: {
              todayCount: todayUploads,
              lastUploadAt: lastUpload.uploadedAt,
            },
          };
        }
      }
    }

    return {
      allowed: true,
      limits,
      currentUsage: { todayCount: todayUploads },
    };
  },
};