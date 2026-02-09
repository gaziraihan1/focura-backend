import { prisma } from "../index.js";


export interface CreateProjectDto {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  startDate?: Date;
  dueDate?: Date;
  workspaceId: string;
  createdById: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  startDate?: Date;
  dueDate?: Date;
}

export interface AddProjectMemberDto {
  userId: string;
  role?: 'MANAGER' | 'COLLABORATOR' | 'VIEWER';
}

export interface UpdateProjectMemberRoleDto {
  role: 'MANAGER' | 'COLLABORATOR' | 'VIEWER';
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  totalMembers: number;
  projectDays: number;
  topPerformer: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}


export class ProjectError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ProjectError';
  }
}

export class UnauthorizedError extends ProjectError {
  constructor(message: string = 'Unauthorized access') {
    super(message, 'UNAUTHORIZED');
  }
}

export class NotFoundError extends ProjectError {
  constructor(message: string = 'Resource not found') {
    super(message, 'NOT_FOUND');
  }
}

export class ValidationError extends ProjectError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}


const getProjectInclude = () => ({
  workspace: {
    select: {
      id: true,
      name: true,
      ownerId: true,
      slug: true
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
    orderBy: { joinedAt: 'asc' as const },
  },
  _count: {
    select: {
      tasks: true,
    },
  },
});

const getProjectDetailsInclude = () => ({
  workspace: {
    select: {
      id: true,
      name: true,
      ownerId: true,
      slug: true
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
    orderBy: { joinedAt: 'asc' as const },
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
    orderBy: { createdAt: 'desc' as const },
  },
  _count: {
    select: {
      tasks: true,
      members: true,
    },
  },
});

const checkWorkspaceAccess = async (userId: string, workspaceId: string) => {
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
    throw new UnauthorizedError('No access to this workspace');
  }

  return workspace;
};

const checkProjectAdminAccess = async (userId: string, projectId: string) => {
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
    include: {
      workspace: true,
    },
  });

  if (!project) {
    throw new UnauthorizedError('Only admins can perform this action');
  }

  return project;
};

const checkProjectAccess = async (userId: string, projectId: string) => {
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
  });

  if (!project) {
    throw new NotFoundError('Project not found or access denied');
  }

  return project;
};

const isUserProjectAdmin = async (userId: string, project: any): Promise<boolean> => {
  if (!project.workspace) {
    return false;
  }

  if (project.workspace.ownerId === userId) {
    return true;
  }

  const workspaceMember = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId: project.workspace.id,
      userId,
      role: {
        in: ['OWNER', 'ADMIN'],
      },
    },
  });

  return !!workspaceMember;
};

const calculateProjectStats = (project: any): ProjectStats => {
  const completedTasks = project.tasks.filter((t: any) => t.status === 'COMPLETED').length;
  const overdueTasks = project.tasks.filter(
    (t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED'
  ).length;

  const startDate = project.startDate || project.createdAt;
  const projectDays = Math.ceil(
    (new Date().getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const taskCompletions = project.tasks
    .filter((t: any) => t.status === 'COMPLETED')
    .flatMap((t: any) => t.assignees.map((a: any) => a.user));

  const performerCounts = taskCompletions.reduce((acc: Record<string, number>, user: any) => {
    acc[user.id] = (acc[user.id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topPerformerId = Object.entries(performerCounts)
    .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0];

  const topPerformer = topPerformerId
    ? project.members.find((m: any) => m.userId === topPerformerId)?.user || null
    : null;

  return {
    totalTasks: project._count.tasks,
    completedTasks,
    overdueTasks,
    totalMembers: project._count.members,
    projectDays,
    topPerformer,
  };
};


export const ProjectService = {
  async getUserProjects(userId: string) {
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          {
            members: {
              some: {
                userId,
              },
            },
          },
          {
            workspace: {
              OR: [
                { ownerId: userId },
                { members: { some: { userId } } },
              ],
            },
          },
        ],
      },
      include: getProjectInclude(),
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const projectsWithAdminFlag = await Promise.all(
      projects.map(async (project) => {
        const isAdmin = await isUserProjectAdmin(userId, project);
        return {
          ...project,
          isAdmin,
        };
      })
    );

    return projectsWithAdminFlag;
  },

  async getProjectsByWorkspace(userId: string, workspaceId: string) {
    await checkWorkspaceAccess(userId, workspaceId);

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

    return projects;
  },

  async getProjectDetails(userId: string, projectId: string) {
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
      include: getProjectDetailsInclude(),
    });

    if (!project) {
      throw new NotFoundError('Project not found or access denied');
    }

    const stats = calculateProjectStats(project);

    const isAdmin = await isUserProjectAdmin(userId, project);

    return {
      ...project,
      stats,
      isAdmin,
    };
  },

  async createProject(data: CreateProjectDto) {
    await checkWorkspaceAccess(data.createdById, data.workspaceId);

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
        createdBy: { connect: { id: data.createdById } },
      },
      include: getProjectInclude(),
    });

    return project;
  },

  async updateProject(userId: string, projectId: string, data: UpdateProjectDto) {
    await checkProjectAdminAccess(userId, projectId);

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
      include: getProjectInclude(),
    });

    return project;
  },

  async deleteProject(userId: string, projectId: string) {
    await checkProjectAdminAccess(userId, projectId);

    await prisma.project.delete({
      where: { id: projectId },
    });
  },

  async addProjectMember(userId: string, projectId: string, data: AddProjectMemberDto) {
    const project = await checkProjectAdminAccess(userId, projectId);

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId: project.workspaceId!,
        userId: data.userId,
      },
    });

    if (!workspaceMember) {
      throw new ValidationError('User is not a member of this workspace');
    }

    const existing = await prisma.projectMember.findFirst({
      where: { projectId, userId: data.userId },
    });

    if (existing) {
      throw new ValidationError('User is already a project member');
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

    return member;
  },

  async updateProjectMemberRole(
    userId: string,
    projectId: string,
    memberId: string,
    data: UpdateProjectMemberRoleDto
  ) {
    await checkProjectAdminAccess(userId, projectId);

    const member = await prisma.projectMember.update({
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

    return member;
  },


  async removeProjectMember(userId: string, projectId: string, memberId: string) {
    await checkProjectAdminAccess(userId, projectId);

    await prisma.projectMember.delete({
      where: { id: memberId },
    });
  },
};