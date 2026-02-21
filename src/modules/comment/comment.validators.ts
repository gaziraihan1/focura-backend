/**
 * comment.validators.ts
 * Responsibility: Request validation schemas for the Comment domain.
 */

import { z } from 'zod';

/** POST / body */
export const createCommentSchema = z.object({
  content:  z.string().min(1, 'Comment content is required').max(5000),
  parentId: z.string().optional().nullable(),
});

/** PUT /:commentId body */
export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(5000),
});

// Inferred types
export type CreateCommentBody = z.infer<typeof createCommentSchema>;
export type UpdateCommentBody = z.infer<typeof updateCommentSchema>;