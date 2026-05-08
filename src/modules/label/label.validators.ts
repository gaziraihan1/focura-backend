import { z } from 'zod';

// ─── Shared pagination schema ─────────────────────────────────────────────────

const paginationSchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const createLabelSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(50, 'Name must be less than 50 characters'),
  color:       z.string().regex(/^#([A-Fa-f0-9]{6})$/, 'Invalid color format (must be #RRGGBB)'),
  description: z.string().optional(),
  workspaceId: z.string().optional(),
});

export const updateLabelSchema = z.object({
  name:        z.string().min(1).max(50).optional(),
  color:       z.string().regex(/^#([A-Fa-f0-9]{6})$/).optional(),
  description: z.string().optional().nullable(),
});

// ─── Query schemas ────────────────────────────────────────────────────────────

export const labelsQuerySchema = paginationSchema.extend({
  workspaceId: z.string().optional(),
});

export const popularLabelsQuerySchema = paginationSchema.extend({
  workspaceId: z.string().optional(),
  // Override default limit to 10 for popular labels
  limit:       z.coerce.number().int().min(1).max(100).default(10),
});

// ─── Tasks sub-resource ───────────────────────────────────────────────────────
// Values mirror the Prisma schema enums exactly (uppercase) so the query
// layer can safely cast string → TaskStatus / Priority with no runtime check.

export const labelTasksQuerySchema = paginationSchema.extend({
  status:   z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateLabelBody    = z.infer<typeof createLabelSchema>;
export type UpdateLabelBody    = z.infer<typeof updateLabelSchema>;
export type PopularLabelsQuery = z.infer<typeof popularLabelsQuerySchema>;
export type LabelsQuery        = z.infer<typeof labelsQuerySchema>;
export type LabelTasksQuery    = z.infer<typeof labelTasksQuerySchema>;