// admin.routes.ts
import { Router } from 'express';
import {
  getAdminStats,
  getAdminWorkspaces,
  getAdminWorkspaceDetail,
  getAdminUsers,
  getAdminProjects,
  getAdminActivity,
} from './admin.controller.js';

export const adminRouter = Router();

adminRouter.get('/stats',                getAdminStats);
adminRouter.get('/workspaces',           getAdminWorkspaces);
adminRouter.get('/workspaces/:id',       getAdminWorkspaceDetail);
adminRouter.get('/users',                getAdminUsers);
adminRouter.get('/projects',             getAdminProjects);
adminRouter.get('/activity',             getAdminActivity);