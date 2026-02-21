/**
 * storage.validators.ts
 * Responsibility: Request validation schemas for the Storage domain.
 *
 * Replaces inline validation in the controller:
 *  - Manual `if (!fileIds || !Array.isArray(fileIds))` check → Zod
 *  - Manual `if (!fileSize || typeof fileSize !== 'number')` check → Zod
 *  - `parseInt(limit as string)` cast → z.coerce.number()
 */

import { z } from 'zod';

/** GET /:workspaceId/largest-files?limit=... */
export const largestFilesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/** POST /:workspaceId/bulk-delete body */
export const bulkDeleteSchema = z.object({
  fileIds: z.array(z.string()).min(1, 'At least one file ID is required'),
});

/** POST /:workspaceId/check-upload body */
export const checkUploadSchema = z.object({
  fileSize: z.number().positive('File size must be a positive number'),
});

// Inferred types
export type LargestFilesQuery = z.infer<typeof largestFilesQuerySchema>;
export type BulkDeleteBody    = z.infer<typeof bulkDeleteSchema>;
export type CheckUploadBody   = z.infer<typeof checkUploadSchema>;