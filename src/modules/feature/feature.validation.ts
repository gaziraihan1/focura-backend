import { z } from 'zod';

export const createFeatureRequestSchema = z.object({
  title:       z.string().min(1).max(150),
  description: z.string().min(1).max(2000),
});

export const updateFeatureStatusSchema = z.object({
  status:    z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PLANNED', 'COMPLETED']),
  adminNote: z.string().max(500).optional(),
});

export const castVoteSchema = z.object({
  type: z.enum(['UP', 'DOWN']),
});

export const listFeaturesSchema = z.object({
  status:   z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PLANNED', 'COMPLETED']).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  search:   z.string().optional(),
});