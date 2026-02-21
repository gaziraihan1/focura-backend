/**
 * project.controller.ts
 * Responsibility: HTTP layer for the Project domain.
 *
 * handleError already well-structured in the original — kept as-is.
 * Static class → plain exported functions (no this binding issues with Express).
 */

import type { Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../../middleware/auth.js';
import { ProjectQuery }    from './project.query.js';
import { ProjectMutation } from './project.mutation.js';
import {
  ProjectError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from './project.types.js';
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
  updateProjectMemberRoleSchema,
} from './project.validators.js';

// ─── Error handler ─────────────────────────────────────────────────────────────

function handleError(error: unknown, res: Response): void {
  if (error instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors:  error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
    return;
  }

  if (error instanceof UnauthorizedError) {
    res.status(403).json({ success: false, message: error.message });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({ success: false, message: error.message });
    return;
  }

  if (error instanceof ValidationError || error instanceof ProjectError) {
    res.status(400).json({ success: false, message: (error as Error).message });
    return;
  }

  console.error('Project controller error:', error);
  res.status(500).json({ success: false, message: 'An unexpected error occurred' });
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

/** GET /projects/user/all */
export const getUserProjects = async (req: AuthRequest, res: Response) => {
  try {
    const projects = await ProjectQuery.getUserProjects(req.user!.id);
    res.json({ success: true, data: projects });
  } catch (error) {
    handleError(error, res);
  }
};

/** GET /projects/:projectId */
export const getProjectDetails = async (req: AuthRequest, res: Response) => {
  try {
    const project = await ProjectQuery.getProjectDetails(req.user!.id, req.params.projectId);
    res.json({ success: true, data: project });
  } catch (error) {
    handleError(error, res);
  }
};

/** GET /projects/workspace/:workspaceId */
export const getProjectsByWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const projects = await ProjectQuery.getProjectsByWorkspace(req.user!.id, req.params.workspaceId);
    res.json({ success: true, data: projects });
  } catch (error) {
    handleError(error, res);
  }
};

/** POST /projects */
export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const data    = createProjectSchema.parse(req.body);
    const project = await ProjectMutation.createProject({ ...data, createdById: req.user!.id });

    res.status(201).json({ success: true, data: project, message: 'Project created successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

/** PATCH /projects/:projectId */
export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const data    = updateProjectSchema.parse(req.body);
    const project = await ProjectMutation.updateProject(req.user!.id, req.params.projectId, data);

    res.json({ success: true, data: project, message: 'Project updated successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

/** DELETE /projects/:projectId */
export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    await ProjectMutation.deleteProject(req.user!.id, req.params.projectId);
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

/** POST /projects/:projectId/members */
export const addProjectMember = async (req: AuthRequest, res: Response) => {
  try {
    const data   = addProjectMemberSchema.parse(req.body);
    const member = await ProjectMutation.addProjectMember(req.user!.id, req.params.projectId, data);

    res.status(201).json({ success: true, data: member, message: 'Member added successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

/** PATCH /projects/:projectId/members/:memberId */
export const updateProjectMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    const data   = updateProjectMemberRoleSchema.parse(req.body);
    const member = await ProjectMutation.updateProjectMemberRole(
      req.user!.id, req.params.projectId, req.params.memberId, data,
    );

    res.json({ success: true, data: member, message: 'Member role updated successfully' });
  } catch (error) {
    handleError(error, res);
  }
};

/** DELETE /projects/:projectId/members/:memberId */
export const removeProjectMember = async (req: AuthRequest, res: Response) => {
  try {
    await ProjectMutation.removeProjectMember(
      req.user!.id, req.params.projectId, req.params.memberId,
    );
    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error) {
    handleError(error, res);
  }
};