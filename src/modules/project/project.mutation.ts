/**
 * project.mutation.ts
 * Responsibility: Write operations for the Project domain.
 *
 * Each mutation: authorize → validate business rules → write.
 * No HTTP, no stats, no analytics.
 */

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

export const ProjectMutation = {
  /**
   * Creates a new project in the given workspace.
   * Creator must be a workspace member.
   */
  async createProject(data: CreateProjectDto) {
    await ProjectAccess.assertWorkspaceAccess(data.createdById, data.workspaceId);

    return prisma.project.create({
      data: {
        name:        data.name,
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

  /**
   * Updates project fields. Only workspace OWNER/ADMIN can update.
   */
  async updateProject(userId: string, projectId: string, data: UpdateProjectDto) {
    await ProjectAccess.assertProjectAdminAccess(userId, projectId);

    return prisma.project.update({
      where:   { id: projectId },
      data,
      include: projectListInclude,
    });
  },

  /**
   * Deletes a project. Only workspace OWNER/ADMIN can delete.
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    await ProjectAccess.assertProjectAdminAccess(userId, projectId);

    await prisma.project.delete({ where: { id: projectId } });
  },

  /**
   * Adds a workspace member to a project.
   * Throws ValidationError if user is not a workspace member or already on project.
   */
  async addProjectMember(userId: string, projectId: string, data: AddProjectMemberDto) {
    const project = await ProjectAccess.assertProjectAdminAccess(userId, projectId);

    // Verify the target user is a workspace member
    const workspaceMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId: project.workspaceId!, userId: data.userId },
    });

    if (!workspaceMember) {
      throw new ValidationError('User is not a member of this workspace');
    }

    // Check for existing project membership
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

  /**
   * Updates a project member's role. Only workspace OWNER/ADMIN can update.
   */
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

  /**
   * Removes a member from a project. Only workspace OWNER/ADMIN can remove.
   */
  async removeProjectMember(
    userId: string,
    projectId: string,
    memberId: string,
  ): Promise<void> {
    await ProjectAccess.assertProjectAdminAccess(userId, projectId);

    await prisma.projectMember.delete({ where: { id: memberId } });
  },
};