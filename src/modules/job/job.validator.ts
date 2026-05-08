import { z } from 'zod';

// ─── Enums ────────────────────────────────────────────────────────────────────
export const JobDepartment  = z.enum(['ENGINEERING','DESIGN','PRODUCT','MARKETING','SALES','CUSTOMER_SUCCESS','OPERATIONS','FINANCE','HR','OTHER']);
export const JobLocationType = z.enum(['REMOTE','ONSITE','HYBRID']);
export const JobType         = z.enum(['FULL_TIME','PART_TIME','CONTRACT','INTERNSHIP','FREELANCE']);
export const JobExperience   = z.enum(['ENTRY','MID','SENIOR','LEAD','EXECUTIVE']);
export const JobStatus       = z.enum(['DRAFT','OPEN','PAUSED','CLOSED']);

// ─── Create ───────────────────────────────────────────────────────────────────
export const createJobSchema = z.object({
  title           : z.string().trim().min(3, 'Title must be at least 3 characters').max(150),
  department      : JobDepartment,
  location        : z.string().trim().min(2).max(100),
  locationType    : JobLocationType.default('REMOTE'),
  type            : JobType.default('FULL_TIME'),
  experienceLevel : JobExperience.default('MID'),
  salaryMin       : z.number().int().positive().optional(),
  salaryMax       : z.number().int().positive().optional(),
  salaryCurrency  : z.string().length(3).default('USD'),
  description     : z.string().trim().min(50, 'Description must be at least 50 characters'),
  requirements    : z.string().trim().min(20, 'Requirements must be at least 20 characters'),
  niceToHave      : z.string().trim().optional(),
  benefits        : z.string().trim().optional(),
  status          : JobStatus.default('DRAFT'),
  closingDate     : z.coerce.date().optional(),
  applicationUrl  : z.string().url().optional().or(z.literal('')),
  applicationEmail: z.string().email().optional(),
  isPinned        : z.boolean().default(false),
}).refine(
  (d) => {
    if (d.salaryMin !== undefined && d.salaryMax !== undefined) {
      return d.salaryMax >= d.salaryMin;
    }
    return true;
  },
  { message: 'salaryMax must be greater than or equal to salaryMin', path: ['salaryMax'] }
);

// ─── Update ───────────────────────────────────────────────────────────────────
export const updateJobSchema = createJobSchema.partial();

// ─── Public query ─────────────────────────────────────────────────────────────
export const listJobsQuerySchema = z.object({
  department  : JobDepartment.optional(),
  locationType: JobLocationType.optional(),
  type        : JobType.optional(),
  search      : z.string().trim().max(100).optional(),
  page        : z.coerce.number().int().min(1).default(1),
  limit       : z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateJobInput   = z.infer<typeof createJobSchema>;
export type UpdateJobInput   = z.infer<typeof updateJobSchema>;
export type ListJobsQuery    = z.infer<typeof listJobsQuerySchema>;