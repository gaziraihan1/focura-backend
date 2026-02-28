
import { prisma } from '../../index.js';
import { getLimitsForPlan, bytesToMB, getTodayStart, getTodayEnd } from './attachment.utils.js';
import type { UploadCheckResult } from './attachment.types.js';

export const AttachmentValidation = {
  async canUpload(
    userId: string,
    workspaceId: string,
    workspacePlan: string,
    fileSizeBytes: number,
  ): Promise<UploadCheckResult> {
    const limits = getLimitsForPlan(workspacePlan);
    const fileSizeMB = bytesToMB(fileSizeBytes);

    if (fileSizeMB > limits.maxFileSizeMB) {
      return {
        allowed: false,
        reason: `File size (${fileSizeMB}MB) exceeds ${limits.maxFileSizeMB}MB limit for ${workspacePlan} plan`,
        limits,
      };
    }

    const todayStart = getTodayStart();
    const todayEnd = getTodayEnd();

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