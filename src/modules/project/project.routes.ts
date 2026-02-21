/**
 * project.routes.ts
 * Responsibility: Route definitions for the Project domain.
 *
 * Route order bug fixed:
 *  ORIGINAL order:
 *    POST   /
 *    GET    /workspace/:workspaceId   ← specific, good
 *    GET    /user/all                 ← PROBLEM: comes after /workspace/:workspaceId
 *                                       but before /:projectId — fragile
 *    GET    /:projectId               ← would match /user as projectId="user"
 *
 *  All specific named paths (/user/all, /workspace/:workspaceId) MUST
 *  come before param paths (/:projectId) to prevent shadowing.
 *
 *  FIXED order: all named GET paths first, then /:projectId.
 */

import { Router } from 'express';
import {
  getUserProjects,
  getProjectsByWorkspace,
  getProjectDetails,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from './project.controller.js';

const router = Router();

// ─── Named GET routes first (must come before /:projectId) ────────────────────
router.get('/user/all',                 getUserProjects);
router.get('/workspace/:workspaceId',   getProjectsByWorkspace);

// ─── Root and param routes ────────────────────────────────────────────────────
router.post('/',                        createProject);
router.get('/:projectId',               getProjectDetails);
router.patch('/:projectId',             updateProject);
router.delete('/:projectId',            deleteProject);

// ─── Project member management ────────────────────────────────────────────────
router.post('/:projectId/members',                      addProjectMember);
router.patch('/:projectId/members/:memberId',            updateProjectMemberRole);
router.delete('/:projectId/members/:memberId',           removeProjectMember);

export default router;