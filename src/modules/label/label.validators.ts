
import { z } from 'zod';

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

export const popularLabelsQuerySchema = z.object({
  workspaceId: z.string().optional(),
  limit:       z.coerce.number().int().min(1).max(100).default(10),
});

export const labelsQuerySchema = z.object({
  workspaceId: z.string().optional(),
});

export type CreateLabelBody       = z.infer<typeof createLabelSchema>;
export type UpdateLabelBody       = z.infer<typeof updateLabelSchema>;
export type PopularLabelsQuery    = z.infer<typeof popularLabelsQuerySchema>;