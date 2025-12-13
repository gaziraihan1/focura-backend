import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
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

const addProjectMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['MANAGER', 'COLLABORATOR', 'VIEWER']).optional(),
});

const updateProjectMemberRoleSchema = z.object({
  role: z.enum(['MANAGER', 'COLLABORATOR', 'VIEWER']),
});

// ========================================================
// GET /projects/:projectId → Get full project details
// ========================================================
export const getProjectDetails = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    // Check if user has access to the project through workspace
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
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
        tasks: {
          include: {
            assignees: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    image: true,
                  },
                },
              },
            },
            _count: {
              select: { comments: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied',
      });
    }

    // Calculate additional stats
    const completedTasks = project.tasks.filter(t => t.status === 'COMPLETED').length;
    const overdueTasks = project.tasks.filter(
      t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED'
    ).length;

    // Calculate project duration
    const startDate = project.startDate || project.createdAt;
    const projectDays = Math.ceil(
      (new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Get top performer (user with most completed tasks)
    const taskCompletions = project.tasks
      .filter(t => t.status === 'COMPLETED')
      .flatMap(t => t.assignees.map(a => a.user));

    const performerCounts = taskCompletions.reduce((acc, user) => {
      acc[user.id] = (acc[user.id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topPerformerId = Object.entries(performerCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    const topPerformer = topPerformerId
      ? project.members.find(m => m.userId === topPerformerId)?.user
      : null;

    // Check user's role in workspace
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: project.workspaceId!,
        userId,
      },
      select: { role: true },
    });

    const isAdmin = 
      project.workspace?.ownerId === userId || 
      workspaceMember?.role === 'ADMIN' ||
      workspaceMember?.role === 'OWNER';

    res.json({
      success: true,
      data: {
        ...project,
        stats: {
          totalTasks: project._count.tasks,
          completedTasks,
          overdueTasks,
          totalMembers: project._count.members,
          projectDays,
          topPerformer,
        },
        isAdmin,
      },
    });
  } catch (error) {
    console.error('Get project details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch project details',
    });
  }
};

// ========================================================
// GET /projects/:workspaceId/list → Projects in workspace
// ========================================================
export const getProjectsByWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { workspaceId } = req.params;

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
      select: {
        id: true,
        name: true,
        color: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        _count: {
          select: { tasks: true, members: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: projects,
    });
  } catch (error) {
    console.error('Get workspace projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace projects',
    });
  }
};

// ========================================================
// POST /projects → Create project
// ========================================================
export const createProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const data = createProjectSchema.parse(req.body);

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
    });

    return res.status(201).json({
      success: true,
      data: project,
      message: 'Project created successfully',
    });
  } catch (error: any) {
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
      message: 'Failed to create project',
    });
  }
};

// ========================================================
// PATCH /projects/:projectId → Update project
// ========================================================
export const updateProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;
    const data = updateProjectSchema.parse(req.body);

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId, role: { in: ['ADMIN', 'OWNER'] } } } },
          ],
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied',
      });
    }

    const updated = await prisma.project.update({
      where: { id: projectId },
      data,
    });

    return res.json({
      success: true,
      data: updated,
      message: 'Project updated successfully',
    });
  } catch (error: any) {
    console.error('Update project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update project',
    });
  }
};

// ========================================================
// POST /projects/:projectId/members → Add project member
// ========================================================
export const addProjectMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;
    const data = addProjectMemberSchema.parse(req.body);

    // Check if requester is admin
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId, role: { in: ['ADMIN', 'OWNER'] } } } },
          ],
        },
      },
      include: { workspace: true },
    });

    if (!project) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can add members',
      });
    }

    // Check if user is workspace member
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: project.workspaceId!,
        userId: data.userId,
      },
    });

    if (!workspaceMember) {
      return res.status(400).json({
        success: false,
        message: 'User is not a member of this workspace',
      });
    }

    // Check if already a project member
    const existing = await prisma.projectMember.findFirst({
      where: { projectId, userId: data.userId },
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User is already a project member',
      });
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: data.userId,
        role: data.role || 'COLLABORATOR',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      data: member,
      message: 'Member added successfully',
    });
  } catch (error: any) {
    console.error('Add project member error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to add member',
    });
  }
};

// ========================================================
// PATCH /projects/:projectId/members/:memberId → Update member role
// ========================================================
export const updateProjectMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId, memberId } = req.params;
    const data = updateProjectMemberRoleSchema.parse(req.body);

    // Check if requester is admin
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId, role: { in: ['ADMIN', 'OWNER'] } } } },
          ],
        },
      },
    });

    if (!project) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can update roles',
      });
    }

    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role: data.role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: updated,
      message: 'Member role updated successfully',
    });
  } catch (error: any) {
    console.error('Update member role error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update member role',
    });
  }
};

// ========================================================
// DELETE /projects/:projectId/members/:memberId → Remove member
// ========================================================
export const removeProjectMember = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId, memberId } = req.params;

    // Check if requester is admin
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId, role: { in: ['ADMIN', 'OWNER'] } } } },
          ],
        },
      },
    });

    if (!project) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Only admins can remove members',
      });
    }

    await prisma.projectMember.delete({
      where: { id: memberId },
    });

    return res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error: any) {
    console.error('Remove member error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove member',
    });
  }
};

// ========================================================
// DELETE /projects/:projectId → Delete project
// ========================================================
export const deleteProject = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        workspace: {
          OR: [
            { ownerId: userId },
            { members: { some: { userId, role: { in: ['ADMIN', 'OWNER'] } } } },
          ],
        },
      },
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
  } catch (error: any) {
    console.error('Delete project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete project',
    });
  }
};