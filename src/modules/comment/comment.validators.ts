import { z } from 'zod';

export const createCommentSchema = z.object({
  content:  z.string().min(1, 'Comment content is required').max(5000),
  parentId: z.string().optional().nullable(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(5000),
});

export type CreateCommentBody = z.infer<typeof createCommentSchema>;
export type UpdateCommentBody = z.infer<typeof updateCommentSchema>;