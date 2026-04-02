import { Response }         from 'express';
import type { AuthRequest } from '../middleware/auth.js';
import { AdminRepository }  from './admin.repository.js';
import { isFocuraAdmin }    from '../config/admin.config.js';
import { z }                from 'zod';

const paginationSchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search:   z.string().optional(),
});

function guardAdmin(req: AuthRequest, res: Response): boolean {
  if (!isFocuraAdmin(req.user!.id)) {
    res.status(403).json({ success: false, message: 'Focura admin access required' });
    return false;
  }
  return true;
}

function handleError(res: Response, label: string, error: unknown) {
  console.error(`Admin ${label} error:`, error);
  res.status(500).json({ success: false, message: `Failed to ${label}` });
}

export const getAdminStats = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const stats = await AdminRepository.getStats();
    res.json({ success: true, data: stats });
  } catch (e) { handleError(res, 'fetch stats', e); }
};

export const getAdminWorkspaces = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const params = paginationSchema.parse(req.query);
    const result = await AdminRepository.getWorkspaces(params);
    res.json({ success: true, ...result });
  } catch (e) { handleError(res, 'fetch workspaces', e); }
};

export const getAdminWorkspaceDetail = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const workspace = await AdminRepository.getWorkspaceDetail(req.params.id);
    if (!workspace) {
      res.status(404).json({ success: false, message: 'Workspace not found' });
      return;
    }
    res.json({ success: true, data: workspace });
  } catch (e) { handleError(res, 'fetch workspace detail', e); }
};

export const getAdminUsers = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const params = paginationSchema.parse(req.query);
    const result = await AdminRepository.getUsers(params);
    res.json({ success: true, ...result });
  } catch (e) { handleError(res, 'fetch users', e); }
};

export const getAdminProjects = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const query  = paginationSchema.parse(req.query);
    const result = await AdminRepository.getProjects({
      ...query,
      workspaceId: req.query.workspaceId as string | undefined,
    });
    res.json({ success: true, ...result });
  } catch (e) { handleError(res, 'fetch projects', e); }
};

export const getAdminActivity = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const params = paginationSchema.parse(req.query);
    const result = await AdminRepository.getActivity(params);
    res.json({ success: true, ...result });
  } catch (e) { handleError(res, 'fetch activity', e); }
};