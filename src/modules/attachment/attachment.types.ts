export interface UploadLimits {
  maxFileSizeMB:            number;
  maxDailyUploads:          number | null;
  minUploadIntervalSeconds: number;
}

export interface UploadCheckResult {
  allowed:          boolean;
  reason?:          string;
  code?:            "STORAGE_FULL" | "FILE_TOO_LARGE" | "DAILY_LIMIT" | "RATE_LIMIT_MINUTE" | "RATE_LIMIT_HOUR";
  storageUsedBytes: number;
  storageMaxBytes:  number | null;
  storageUsedPct:   number | null;
  remainingBytes:   number | null;
  retryAfterMs?:    number;
}

export interface AddAttachmentInput {
  taskId: string;
  userId: string;
  file: {
    buffer:       Buffer;
    originalname: string;
    mimetype:     string;
    size:         number;
    name?:        string;
  };
}

export interface StorageStats {
  usedBytes:      number;
  maxBytes:       number | null;
  remainingBytes: number | null;
  usedPct:        number | null;
  usedFormatted:  string;
  maxFormatted:   string | null;
  isNearLimit:    boolean;
  isFull:         boolean;
  plan:           string;
  limits: {
    maxFileSizeMB:    number;
    maxDailyUploads:  number | null;
    uploadsPerMinute: number | null;
    uploadsPerHour:   number | null;
  };
}

export interface AttachmentStats {
  totalFiles:   number;
  totalSizeMB:  number;
  storage:      StorageStats;     // ← added
  userUploads: Array<{
    userId:      string;
    userName:    string;
    fileCount:   number;
    totalSizeMB: number;
  }>;
}

export const TIER_LIMITS: Record<string, UploadLimits> = {
  FREE: {
    maxFileSizeMB:            5,
    maxDailyUploads:          10,
    minUploadIntervalSeconds: 300,
  },
  PRO: {
    maxFileSizeMB:            25,
    maxDailyUploads:          100,
    minUploadIntervalSeconds: 0,
  },
  BUSINESS: {
    maxFileSizeMB:            100,
    maxDailyUploads:          null,
    minUploadIntervalSeconds: 0,
  },
  ENTERPRISE: {
    maxFileSizeMB:            500,
    maxDailyUploads:          null,
    minUploadIntervalSeconds: 0,
  },
};