
import { prisma } from '../../index.js';
import type {
  CreateProjectDto,
  UpdateProjectDto,
  AddProjectMemberDto,
  UpdateProjectMemberRoleDto,
} from './project.types.js';
import { ValidationError } from './project.types.js';
import { projectListInclude, projectMemberInclude } from './project.selects.js';
import { ProjectAccess } from './project.access.js';
import { SlugService } from '../../services/slug.service.js';

export const ProjectMutation = {
  async createProject(data: CreateProjectDto) {
    await ProjectAccess.assertWorkspaceAccess(data.createdById, data.workspaceId);
    const slug = await SlugService.generateProjectSlug(data.name, data.workspaceId)

    return prisma.project.create({
      data: {
        name:        data.name,
        slug,
        description: data.description,
        color:       data.color    ?? '#667eea',
        icon:        data.icon,
        status:      data.status   ?? 'ACTIVE',
        priority:    data.priority ?? 'MEDIUM',
        startDate:   data.startDate,
        dueDate:     data.dueDate,
        workspace:   { connect: { id: data.workspaceId } },
        createdBy:   { connect: { id: data.createdById } },
      },
      include: projectListInclude,
    });
  },

  async updateProject(userId: string, projectId: string, data: UpdateProjectDto) {
    await ProjectAccess.assertProjectAdminAccess(userId, projectId);

    return prisma.project.update({
      where:   { id: projectId },
      data,
      include: projectListInclude,
    });
  },

  async deleteProject(userId: string, projectId: string): Promise<void> {
    await ProjectAccess.assertProjectAdminAccess(userId, projectId);

    await prisma.project.delete({ where: { id: projectId } });
  },

  async addProjectMember(userId: string, projectId: string, data: AddProjectMemberDto) {
    const project = await ProjectAccess.assertProjectAdminAccess(userId, projectId);

    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId!, userId: data.userId },
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

    return prisma.projectMember.create({
      data: {
        projectId,
        userId: data.userId,
        role:   data.role ?? 'COLLABORATOR',
      },
      include: projectMemberInclude,
    });
  },

  async updateProjectMemberRole(
    userId: string,
    projectId: string,
    memberId: string,
    data: UpdateProjectMemberRoleDto,
  ) {
    await ProjectAccess.assertProjectAdminAccess(userId, projectId);

    return prisma.projectMember.update({
      where:   { id: memberId },
      data:    { role: data.role },
      include: projectMemberInclude,
    });
  },

  async removeProjectMember(
    userId: string,
    projectId: string,
    memberId: string,
  ): Promise<void> {
    await ProjectAccess.assertProjectAdminAccess(userId, projectId);

    await prisma.projectMember.delete({ where: { id: memberId } });
  },
};