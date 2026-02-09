import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import {
  ProjectService,
  ProjectError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
} from '../services/project.service.js';


const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  icon: z.string().optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  icon: z.string().optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
});

const addProjectMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['MANAGER', 'COLLABORATOR', 'VIEWER']).optional(),
});

const updateProjectMemberRoleSchema = z.object({
  role: z.enum(['MANAGER', 'COLLABORATOR', 'VIEWER']),
});


const handleError = (error: unknown, res: Response) => {
  console.error('Project controller error:', error);

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.issues.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    });
  }

  if (error instanceof UnauthorizedError) {
    return res.status(403).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof NotFoundError) {
    return res.status(404).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof ValidationError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error instanceof ProjectError) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: 'An unexpected error occurred',
  });
};


export const getUserProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const projects = await ProjectService.getUserProjects(userId);

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const getProjectDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const project = await ProjectService.getProjectDetails(userId, projectId);

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const getProjectsByWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { workspaceId } = req.params;

    const projects = await ProjectService.getProjectsByWorkspace(userId, workspaceId);

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const validatedData = createProjectSchema.parse(req.body);

    const project = await ProjectService.createProject({
      ...validatedData,
      createdById: userId,
    });

    res.status(201).json({
      success: true,
      data: project,
      message: 'Project created successfully',
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;
    const validatedData = updateProjectSchema.parse(req.body);

    const project = await ProjectService.updateProject(userId, projectId, validatedData);

    res.json({
      success: true,
      data: project,
      message: 'Project updated successfully',
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    await ProjectService.deleteProject(userId, projectId);

    res.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const addProjectMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;
    const validatedData = addProjectMemberSchema.parse(req.body);

    const member = await ProjectService.addProjectMember(userId, projectId, validatedData);

    res.status(201).json({
      success: true,
      data: member,
      message: 'Member added successfully',
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const updateProjectMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId, memberId } = req.params;
    const validatedData = updateProjectMemberRoleSchema.parse(req.body);

    const member = await ProjectService.updateProjectMemberRole(
      userId,
      projectId,
      memberId,
      validatedData
    );

    res.json({
      success: true,
      data: member,
      message: 'Member role updated successfully',
    });
  } catch (error) {
    handleError(error, res);
  }
};

export const removeProjectMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId, memberId } = req.params;

    await ProjectService.removeProjectMember(userId, projectId, memberId);

    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    handleError(error, res);
  }
};