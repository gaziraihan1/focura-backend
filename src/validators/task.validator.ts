// lib/validators/task.validator.ts
import { z } from 'zod';

const intentEnum = z.enum(['EXECUTION', 'PLANNING', 'REVIEW', 'LEARNING', 'COMMUNICATION']);
const energyTypeEnum = z.enum(['LOW', 'MEDIUM', 'HIGH']);

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  projectId: z.string().uuid().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().datetime().transform(str => new Date(str)).optional(),
  startDate: z.string().datetime().transform(str => new Date(str)).optional(),
  estimatedHours: z.number().min(0).optional(),
  focusRequired: z.boolean().optional(),
  focusLevel: z.number().min(1).max(5).optional(),
  energyType: energyTypeEnum.optional(),
  distractionCost: z.number().min(0).max(5).optional(),
  intent: intentEnum.optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().datetime().transform(str => new Date(str)).nullable().optional(),
  startDate: z.string().datetime().transform(str => new Date(str)).nullable().optional(),
  estimatedHours: z.number().min(0).optional(),
  focusRequired: z.boolean().optional(),
  focusLevel: z.number().min(1).max(5).optional(),
  energyType: energyTypeEnum.nullable().optional(),
  distractionCost: z.number().min(0).max(5).optional(),
  intent: intentEnum.optional(),
});

class TaskValidator {
  create(data: unknown) {
    try {
      const validated = createTaskSchema.parse(data);
      return { success: true as const, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false as const, errors: error.issues };
      }
      return { success: false as const, errors: [{ message: 'Validation failed' }] };
    }
  }

  update(data: unknown) {
    try {
      const validated = updateTaskSchema.parse(data);
      return { success: true as const, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { success: false as const, errors: error.issues };
      }
      return { success: false as const, errors: [{ message: 'Validation failed' }] };
    }
  }
}

export const taskValidator = new TaskValidator();