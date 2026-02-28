
import { z } from 'zod';

export const largestFilesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const bulkDeleteSchema = z.object({
  fileIds: z.array(z.string()).min(1, 'At least one file ID is required'),
});

export const checkUploadSchema = z.object({
  fileSize: z.number().positive('File size must be a positive number'),
});

export type LargestFilesQuery = z.infer<typeof largestFilesQuerySchema>;
export type BulkDeleteBody    = z.infer<typeof bulkDeleteSchema>;
export type CheckUploadBody   = z.infer<typeof checkUploadSchema>;