import { z } from "zod";

const taskStatusEnum = z.enum([
  "TODO",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);
const taskPriorityEnum = z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]);

export const createSubtaskSchema = z.object({
  title: z.string().min(1, "Subtask title is required").max(500),
  description: z.string().optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.coerce.date().optional(),
  estimatedHours: z.number().min(0).optional(),
  assigneeIds: z.array(z.string()).max(5).optional(),
});

export const updateSubtaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.coerce.date().nullable().optional(),
  estimatedHours: z.number().min(0).optional(),
});

export const updateSubtaskStatusSchema = z.object({
  status: taskStatusEnum,
});

export type CreateSubtaskBody = z.infer<typeof createSubtaskSchema>;
export type UpdateSubtaskBody = z.infer<typeof updateSubtaskSchema>;
export type UpdateSubtaskStatusBody = z.infer<typeof updateSubtaskStatusSchema>;
