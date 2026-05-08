import { Request, Response }            from 'express';
import { createJobSchema,
         updateJobSchema,
         listJobsQuerySchema }          from './job.validator.js';
import { listOpenJobs, getOpenJob,
         createJob, updateJob,
         deleteJob, listAllJobs,
         togglePin }                    from './job.service.js';
import { AuthRequest } from '../../middleware/auth.js';
import { isFocuraAdmin } from '../../config/admin.config.js';

// ─── Error Handler Helper ─────────────────────────────────────────────────────
const handleError = (res: Response, error: unknown, defaultMessage = 'INTERNAL_ERROR'): void => {
  console.error('[JobController] Error:', error);

  // Handle known error types
  if (error instanceof Error) {
    if (error.message === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Resource not found.' });
      return;
    }
    if (error.message.startsWith('VALIDATION_')) {
      res.status(422).json({ success: false, error: 'VALIDATION_ERROR', message: error.message });
      return;
    }
  }

  // Default: internal server error
  res.status(500).json({ 
    success: false, 
    error: defaultMessage, 
    message: process.env.NODE_ENV === 'development' ? (error as Error).message : 'An unexpected error occurred.' 
  });
};

// ─── Public ───────────────────────────────────────────────────────────────────
export async function publicListJobs(req: Request, res: Response): Promise<void> {
  try {
    const parsed = listJobsQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(422).json({ success: false, error: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    const result = await listOpenJobs(parsed.data);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, 'FETCH_JOBS_FAILED');
  }
}

export async function publicGetJob(req: Request, res: Response): Promise<void> {
  try {
    const job = await getOpenJob(req.params.slug);

    if (!job) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Job not found.' });
      return;
    }

    res.status(200).json({ success: true, data: job });
  } catch (error) {
    handleError(res, error, 'FETCH_JOB_FAILED');
  }
}

// ─── Admin ────────────────────────────────────────────────────────────────────
export async function adminListJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!isFocuraAdmin(req.user?.id!)) {
      res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to access this resource.' });
      return;
    }

    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    
    const result = await listAllJobs(page, limit);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, 'LIST_JOBS_FAILED');
  }
}

export async function adminCreateJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    const parsed = createJobSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(422).json({ success: false, error: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    if (!isFocuraAdmin(req.user?.id!)) {
      res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to access this resource.' });
      return;
    }

    const postedById = (req as any).user?.id as string;
    const job = await createJob(parsed.data, postedById);

    res.status(201).json({ success: true, message: 'Job posting created.', data: job });
  } catch (error) {
    handleError(res, error, 'CREATE_JOB_FAILED');
  }
}

export async function adminUpdateJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    const parsed = updateJobSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(422).json({ success: false, error: 'VALIDATION_ERROR', errors: parsed.error.flatten().fieldErrors });
      return;
    }

    if (!isFocuraAdmin(req.user?.id!)) {
      res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to access this resource.' });
      return; // ✅ Fixed: missing return
    }

    const job = await updateJob(req.params.id, parsed.data);
    
    if (!job) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Job not found.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Job posting updated.', data: job });
  } catch (error) {
    handleError(res, error, 'UPDATE_JOB_FAILED');
  }
}

export async function adminDeleteJob(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!isFocuraAdmin(req.user?.id!)) {
      res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to access this resource.' });
      return;
    }

    const deleted = await deleteJob(req.params.id);
    
    if (!deleted) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Job not found.' });
      return;
    }

    res.status(200).json({ success: true, message: 'Job posting deleted.' });
  } catch (error) {
    handleError(res, error, 'DELETE_JOB_FAILED');
  }
}

export async function adminTogglePin(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!isFocuraAdmin(req.user?.id!)) {
      res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You do not have permission to access this resource.' });
      return;
    }

    const job = await togglePin(req.params.id);
    
    if (!job) {
      res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Job not found.' });
      return;
    }

    res.status(200).json({ 
      success: true, 
      message: `Job ${job.isPinned ? 'pinned' : 'unpinned'}.`, 
      data: job 
    });
  } catch (error) {
    handleError(res, error, 'TOGGLE_PIN_FAILED');
  }
}