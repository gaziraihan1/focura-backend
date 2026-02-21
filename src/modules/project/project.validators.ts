/**
 * project.validators.ts
 * Responsibility: Request validation schemas for the Project domain.
 *
 * Extracted from the controller where they were defined at module scope.
 * Enum values extracted from project.types.ts to keep a single source of truth.
 */

import { z } from 'zod';

const projectStatusEnum   = z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']);
const projectPriorityEnum = z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']);
const projectRoleEnum     = z.enum(['MANAGER', 'COLLABORATOR', 'VIEWER']);
const colorRegex          = /^#[0-9A-F]{6}$/i;

/** POST / body */
export const createProjectSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional(),
  color:       z.string().regex(colorRegex, 'Invalid color format').optional(),
  icon:        z.string().optional(),
  status:      projectStatusEnum.optional(),
  priority:    projectPriorityEnum.optional(),
  startDate:   z.coerce.date().optional(),
  dueDate:     z.coerce.date().optional(),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

/** PATCH /:projectId body */
export const updateProjectSchema = z.object({
  name:        z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color:       z.string().regex(colorRegex).optional(),
  icon:        z.string().optional(),
  status:      projectStatusEnum.optional(),
  priority:    projectPriorityEnum.optional(),
  startDate:   z.coerce.date().optional(),
  dueDate:     z.coerce.date().optional(),
});

/** POST /:projectId/members body */
export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role:   projectRoleEnum.optional(),
});

/** PATCH /:projectId/members/:memberId body */
export const updateProjectMemberRoleSchema = z.object({
  role: projectRoleEnum,
});

// Inferred types
export type CreateProjectBody            = z.infer<typeof createProjectSchema>;
export type UpdateProjectBody            = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberBody         = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberRoleBody  = z.infer<typeof updateProjectMemberRoleSchema>;