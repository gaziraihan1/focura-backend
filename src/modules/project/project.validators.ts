import { z } from "zod";

const projectStatusEnum = z.enum([
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "ARCHIVED",
]);
const projectPriorityEnum = z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]);
const projectRoleEnum = z.enum(["MANAGER", "COLLABORATOR", "VIEWER"]);
const colorRegex = /^#[0-9A-F]{6}$/i;

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
  description: z.string().optional(),
  color: z.string().regex(colorRegex, "Invalid color format").optional(),
  icon: z.string().optional(),
  status: projectStatusEnum.optional(),
  priority: projectPriorityEnum.optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  workspaceId: z.string().min(1, "Workspace ID is required"),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(colorRegex).optional(),
  icon: z.string().optional(),
  status: projectStatusEnum.optional(),
  priority: projectPriorityEnum.optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  role: projectRoleEnum.optional(),
});

export const updateProjectMemberRoleSchema = z.object({
  role: projectRoleEnum,
});

export type CreateProjectBody = z.infer<typeof createProjectSchema>;
export type UpdateProjectBody = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberBody = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberRoleBody = z.infer<
  typeof updateProjectMemberRoleSchema
>;
