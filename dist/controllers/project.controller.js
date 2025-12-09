import { prisma } from '../index.js';
import { z } from 'zod';
// Validation schemas
const createProjectSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    icon: z.string().optional(),
    status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).optional(),
    priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']).optional(),
    startDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().optional(),
    workspaceId: z.string().min(1),
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
// ========================================================
// GET /projects   → All projects user has access to
// ========================================================
export const getAllProjects = async (req, res) => {
    try {
        const userId = req.user.id;
        const projects = await prisma.project.findMany({
            where: {
                workspace: {
                    OR: [
                        { ownerId: userId },
                        { members: { some: { userId } } },
                    ],
                },
            },
            select: { id: true, name: true, color: true },
            orderBy: { name: 'asc' },
        });
        res.json({
            success: true,
            data: projects,
        });
    }
    catch (error) {
        console.error('Get all projects error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch projects',
        });
    }
};
// ========================================================
// POST /projects → Create project under a workspace
// ========================================================
export const createProject = async (req, res) => {
    try {
        const userId = req.user.id;
        const data = createProjectSchema.parse(req.body);
        // Check workspace access
        const workspace = await prisma.workspace.findFirst({
            where: {
                id: data.workspaceId,
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId } } },
                ],
            },
        });
        if (!workspace) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: No access to this workspace',
            });
        }
        const PLAN_PROJECT_LIMITS = {
            FREE: 2,
            PRO: 5,
            BUSINESS: 10,
            ENTERPRISE: Infinity,
        };
        const plan = workspace.plan || 'FREE';
        const limit = PLAN_PROJECT_LIMITS[plan] ?? 2;
        const projectCount = await prisma.project.count({
            where: { workspaceId: data.workspaceId },
        });
        if (projectCount >= limit) {
            return res.status(400).json({
                success: false,
                message: `Project limit reached for ${plan} plan. Allowed: ${limit === Infinity ? 'unlimited' : limit}`,
                code: 'PROJECT_LIMIT_REACHED',
            });
        }
        const project = await prisma.project.create({
            data: {
                name: data.name,
                description: data.description,
                color: data.color || '#667eea',
                icon: data.icon,
                status: data.status || 'ACTIVE',
                priority: data.priority || 'MEDIUM',
                startDate: data.startDate,
                dueDate: data.dueDate,
                workspace: { connect: { id: data.workspaceId } },
                createdBy: { connect: { id: userId } },
            },
            select: {
                id: true,
                name: true,
                description: true,
                color: true,
                icon: true,
                status: true,
                priority: true,
                startDate: true,
                dueDate: true,
                workspaceId: true,
            },
        });
        return res.status(201).json({
            success: true,
            data: project,
            message: 'Project created successfully',
        });
    }
    catch (error) {
        console.error('Create project error:', error);
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors,
            });
        }
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to create project',
        });
    }
};
// ========================================================
// PATCH /projects/:projectId → Update a project
// ========================================================
export const updateProject = async (req, res) => {
    try {
        const userId = req.user.id;
        const { projectId } = req.params;
        const data = updateProjectSchema.parse(req.body);
        // Ensure project is accessible through workspace membership/ownership
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                workspace: {
                    OR: [
                        { ownerId: userId },
                        { members: { some: { userId } } },
                    ],
                },
            },
            select: { id: true },
        });
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found or access denied',
            });
        }
        const updated = await prisma.project.update({
            where: { id: projectId },
            data: {
                ...data,
            },
            select: {
                id: true,
                name: true,
                description: true,
                color: true,
                icon: true,
                status: true,
                priority: true,
                startDate: true,
                dueDate: true,
                workspaceId: true,
            },
        });
        return res.json({
            success: true,
            data: updated,
            message: 'Project updated successfully',
        });
    }
    catch (error) {
        console.error('Update project error:', error);
        if (error.name === 'ZodError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: error.errors,
            });
        }
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to update project',
        });
    }
};
// ========================================================
// DELETE /projects/:projectId → Delete a project
// ========================================================
export const deleteProject = async (req, res) => {
    try {
        const userId = req.user.id;
        const { projectId } = req.params;
        const project = await prisma.project.findFirst({
            where: {
                id: projectId,
                workspace: {
                    OR: [
                        { ownerId: userId },
                        { members: { some: { userId } } },
                    ],
                },
            },
            select: { id: true },
        });
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Project not found or access denied',
            });
        }
        await prisma.project.delete({
            where: { id: projectId },
        });
        return res.json({
            success: true,
            message: 'Project deleted successfully',
        });
    }
    catch (error) {
        console.error('Delete project error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete project',
        });
    }
};
// ========================================================
// GET /projects/:workspaceId → Projects ONLY in that workspace
// ========================================================
export const getProjectsByWorkspace = async (req, res) => {
    try {
        const userId = req.user.id;
        const { workspaceId } = req.params;
        // First, check if the user has access to this workspace
        const workspace = await prisma.workspace.findFirst({
            where: {
                id: workspaceId,
                OR: [
                    { ownerId: userId },
                    { members: { some: { userId } } },
                ],
            },
        });
        if (!workspace) {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: No access to this workspace',
            });
        }
        const projects = await prisma.project.findMany({
            where: { workspaceId },
            select: { id: true, name: true, color: true },
            orderBy: { name: 'asc' },
        });
        res.json({
            success: true,
            data: projects,
        });
    }
    catch (error) {
        console.error('Get workspace projects error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch workspace projects',
        });
    }
};
//# sourceMappingURL=project.controller.js.map