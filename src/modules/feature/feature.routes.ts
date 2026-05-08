// feature.routes.ts
import { Router } from 'express';
import {
  createFeatureRequest,
  getFeatureRequests,
  getFeatureRequest,
  updateFeatureStatus,
  deleteFeatureRequest,
  castVote,
  getAdminContext,
  removeVote
} from './feature.controller.js';
import { getFocuraAdminIds, isFocuraAdmin } from '../../config/admin.config.js';

export const featureRouter = Router();

// Temporarily add to feature.routes.ts
featureRouter.get('/debug/admin-ids', (req, res) => {
  res.json({
    raw:   process.env.FOCURA_ADMIN_IDS,
    ids:   getFocuraAdminIds(),
    userId: (req as any).user?.id,
    match: isFocuraAdmin((req as any).user?.id),
  });
});
featureRouter.get(   '/',               getFeatureRequests);
featureRouter.post(  '/',               createFeatureRequest);
featureRouter.get(   '/admin/me',       getAdminContext);        // is current user admin?
featureRouter.get(   '/:id',            getFeatureRequest);
featureRouter.patch( '/:id/status',     updateFeatureStatus);
featureRouter.delete('/:id',            deleteFeatureRequest);
featureRouter.post(  '/:id/vote',       castVote);
featureRouter.delete('/:id/vote',       removeVote)