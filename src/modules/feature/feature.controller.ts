import { Response }          from 'express';
import { z }                 from 'zod';
import type { AuthRequest }  from '../../middleware/auth.js';
import { FeatureService }    from './feature.service.js';
import { isFocuraAdmin }     from '../../config/admin.config.js';
import {
  createFeatureRequestSchema,
  updateFeatureStatusSchema,
  castVoteSchema,
  listFeaturesSchema,
} from './feature.validation.js';

function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({ success: false, message: 'Validation error', errors: error.issues });
    return;
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.startsWith('NOT_FOUND:'))   { res.status(404).json({ success: false, message: msg.replace('NOT_FOUND: ', '') });   return; }
    if (msg.startsWith('FORBIDDEN:'))   { res.status(403).json({ success: false, message: msg.replace('FORBIDDEN: ', '') });   return; }
    if (msg.startsWith('BAD_REQUEST:')) { res.status(400).json({ success: false, message: msg.replace('BAD_REQUEST: ', '') }); return; }
    console.error(`${label} error:`, error);
    res.status(500).json({ success: false, message: `Failed to ${label}` });
    return;
  }
  res.status(500).json({ success: false, message: `Failed to ${label}` });
}

export const createFeatureRequest = async (req: AuthRequest, res: Response) => {
  try {
    const body    = createFeatureRequestSchema.parse(req.body);
    const feature = await FeatureService.create({ ...body, createdById: req.user!.id });
    res.status(201).json({ success: true, data: feature });
  } catch (e) { handleError(res, 'create feature request', e); }
};

export const getFeatureRequests = async (req: AuthRequest, res: Response) => {
  try {
    const query  = listFeaturesSchema.parse(req.query);
    const result = await FeatureService.getMany(query, req.user!.id);
    res.json({ success: true, ...result });
  } catch (e) { handleError(res, 'fetch feature requests', e); }
};

export const getFeatureRequest = async (req: AuthRequest, res: Response) => {
  try {
    const feature = await FeatureService.getOne(req.params.id, req.user!.id);
    res.json({ success: true, data: feature });
  } catch (e) { handleError(res, 'fetch feature request', e); }
};

export const updateFeatureStatus = async (req: AuthRequest, res: Response) => {
  try {
    const body    = updateFeatureStatusSchema.parse(req.body);
    const feature = await FeatureService.updateStatus(req.params.id, req.user!.id, body);
    res.json({ success: true, data: feature });
  } catch (e) { handleError(res, 'update feature status', e); }
};

export const deleteFeatureRequest = async (req: AuthRequest, res: Response) => {
  try {
    await FeatureService.delete(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Feature request deleted' });
  } catch (e) { handleError(res, 'delete feature request', e); }
};

export const castVote = async (req: AuthRequest, res: Response) => {
  try {
    const { type } = castVoteSchema.parse(req.body);
    const result   = await FeatureService.vote(req.params.id, req.user!.id, type);
    res.json({ success: true, ...result });
  } catch (e) { handleError(res, 'cast vote', e); }
};

export const getAdminContext = async (req: AuthRequest, res: Response) => {
  res.json({ success: true, isAdmin: isFocuraAdmin(req.user!.id) });
};

export const removeVote = async (req: AuthRequest, res: Response) => {
  try {
    await FeatureService.removeVote(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (e) {
    handleError(res, 'remove vote', e);
  }
};