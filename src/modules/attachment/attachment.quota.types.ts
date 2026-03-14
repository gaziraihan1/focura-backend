export type WorkspacePlan = "FREE" | "PRO" | "BUSINESS" | "ENTERPRISE";

export interface StorageLimits {
  maxStorageBytes:          number | null;   // null = unlimited
  maxFileSizeBytes:         number;
  maxDailyUploadsPerUser:   number | null;   // null = unlimited
  // Sliding-window rate limits
  uploadsPerMinute:         number | null;   // null = unlimited
  uploadsPerHour:           number | null;   // null = unlimited
}

export interface SlidingWindowResult {
  allowed:       boolean;
  count:         number;       // requests in current window
  retryAfterMs:  number;
}

export interface UploadCheckResult {
  allowed:          boolean;
  reason?:          string;
  code?:            "STORAGE_FULL" | "FILE_TOO_LARGE" | "DAILY_LIMIT" | "RATE_LIMIT_MINUTE" | "RATE_LIMIT_HOUR";
  storageUsedBytes: number;
  storageMaxBytes:  number | null;
  storageUsedPct:   number | null;   // 0–100
  remainingBytes:   number | null;
  retryAfterMs?:    number;
}

export interface StorageInfo {
  plan:             WorkspacePlan;
  usedBytes:        number;
  maxBytes:         number | null;
  remainingBytes:   number | null;
  usedPct:          number | null;   // 0–100
  usedFormatted:    string;
  maxFormatted:     string | null;
  isNearLimit:      boolean;         // >= 80%
  isFull:           boolean;         // >= 100%
  limits:           StorageLimits;
}