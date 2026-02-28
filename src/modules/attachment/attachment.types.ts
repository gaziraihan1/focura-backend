
export interface UploadLimits {
  maxFileSizeMB: number;
  maxDailyUploads: number;
  minUploadIntervalSeconds: number;
}

export interface UploadCheckResult {
  allowed: boolean;
  reason?: string;
  limits?: UploadLimits;
  currentUsage?: {
    todayCount: number;
    lastUploadAt?: Date;
  };
}

export interface AddAttachmentInput {
  taskId: string;
  userId: string;
  file: {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
    size: number;
    name?: string
  };
}

export interface AttachmentStats {
  totalFiles: number;
  totalSizeMB: number;
  userUploads: Array<{
    userId: string;
    userName: string;
    fileCount: number;
    totalSizeMB: number;
  }>;
}

export const TIER_LIMITS: Record<string, UploadLimits> = {
  FREE: {
    maxFileSizeMB: 5,
    maxDailyUploads: 10,
    minUploadIntervalSeconds: 300, // 5 minutes
  },
  PRO: {
    maxFileSizeMB: 12,
    maxDailyUploads: 30,
    minUploadIntervalSeconds: 120, // No rate limit
  },
  BUSINESS: {
    maxFileSizeMB: 30,
    maxDailyUploads: 100,
    minUploadIntervalSeconds: 30, // No rate limit
  },
  ENTERPRISE: {
    maxFileSizeMB: 100,
    maxDailyUploads: 500,
    minUploadIntervalSeconds: 0, // No rate limit
  },
};