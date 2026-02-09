
import { PrismaClient, WorkspaceRole } from '@prisma/client';
import crypto from 'crypto';
import { sendInvitationEmail } from '../utils/email.js';
import { notifyUser } from '../utils/notification.helpers.js';
import * as slugifyModule from "slugify";
const slugify = (slugifyModule as any).default || slugifyModule;

const prisma = new PrismaClient();

export class WorkspaceService {
  
  static async generateSlug(name: string): Promise<string> {
  let slug = slugify(name, { lower: true, strict: true });
  let counter = 1;

  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${slugify(name, { lower: true, strict: true })}-${counter}`;
    counter++;
  }

  return slug;
}
  
  // Get all user workspaces
  static async getUserWorkspaces(userId: string) {
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
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
        },
        _count: {
          select: {
            projects: true,
            members: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    
    return workspaces;
  }
  
  // Create workspace
  static async create(userId: string, data: any) {

     const WORKSPACE_LIMITS: any = {
    FREE: 1,
    PRO: 5,
    BUSINESS: 15,
    ENTERPRISE: Infinity,
  };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  if (!user) throw new Error("User not found");

  const userPlan = user.plan || "FREE";
  const maxAllowed = WORKSPACE_LIMITS[userPlan];

  // Count user workspaces
  const workspaceCount = await prisma.workspace.count({
    where: { ownerId: userId },
  });

  if (workspaceCount >= maxAllowed) {
    throw new Error(
      `Workspace limit reached for your ${userPlan} plan. Allowed: ${maxAllowed}`
    );
  }
    const slug = await this.generateSlug(data.name);
    
    const workspace = await prisma.workspace.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        color: data.color || '#667eea',
        logo: data.logo,
        isPublic: data.isPublic || false,
        plan: data.plan || 'FREE',
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
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
        },
      },
    });
    
    // Create activity log
    await prisma.activity.create({
      data: {
        action: 'CREATED',
        entityType: 'WORKSPACE',
        entityId: workspace.id,
        userId,
        workspaceId: workspace.id,
        metadata: {
          workspaceName: workspace.name,
        },
      },
    });
    
    return workspace;
  }
  
  // Get workspace by slug
  static async getBySlug(slug: string, userId: string) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        slug,
        OR: [
          { ownerId: userId },
          { isPublic: true },
          {
            members: {
              some: { userId },
            },
          },
        ],
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
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
        projects: {
          take: 10,
          orderBy: { updatedAt: 'desc' },
          include: {
            _count: {
              select: { tasks: true },
            },
          },
        },
        _count: {
          select: {
            projects: true,
            members: true,
            labels: true,
          },
        },
      },
    });
    
    if (!workspace) {
      throw new Error('Workspace not found');
    }
    
    return workspace;
  }

  // Add this method to your WorkspaceService class in workspace.service.ts

static async getById(id: string, userId: string) {
  const workspace = await prisma.workspace.findFirst({
    where: {
      id,
      OR: [
        { ownerId: userId },
        { isPublic: true },
        {
          members: {
            some: { userId },
          },
        },
      ],
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
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
      projects: {
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      },
      _count: {
        select: {
          projects: true,
          members: true,
          labels: true,
        },
      },
    },
  });
  
  if (!workspace) {
    throw new Error('Workspace not found');
  }
  
  return workspace;
}
  
  // Update workspace
  static async update(workspaceId: string, userId: string, data: any) {
    // Check if user has permission (owner or admin)
    const member = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    });
    
    if (!member) {
      throw new Error('Unauthorized');
    }
    
    const workspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        logo: data.logo,
        isPublic: data.isPublic,
        allowInvites: data.allowInvites,
      },
      include: {
        owner: true,
        members: {
          include: { user: true },
        },
      },
    });
    
    // Log activity
    await prisma.activity.create({
      data: {
        action: 'UPDATED',
        entityType: 'WORKSPACE',
        entityId: workspaceId,
        userId,
        workspaceId,
      },
    });
    
    return workspace;
  }
  
  // Delete workspace
  static async delete(workspaceId: string, userId: string) {
    // Only owner can delete
    const workspace = await prisma.workspace.findFirst({
      where: { id: workspaceId, ownerId: userId },
    });
    
    if (!workspace) {
      throw new Error('Unauthorized');
    }
    
    await prisma.workspace.delete({
      where: { id: workspaceId },
    });
  }
  
  // Get workspace members
  static async getMembers(workspaceId: string, userId: string) {
    // Check if user is member
    const isMember = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    
    if (!isMember) {
      throw new Error('Unauthorized');
    }
    
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
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
    });
    
    return members;
  }
  
  // Invite member
  static async inviteMember(
    workspaceId: string,
    inviterId: string,
    email: string,
    role: WorkspaceRole
  ) {
    // Check if inviter has permission
    const inviter = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: inviterId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    });
    
    if (!inviter) {
      throw new Error('Unauthorized');
    }
    
    // Check if already invited or member
    const existingInvite = await prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        status: 'PENDING',
      },
    });
    
    if (existingInvite) {
      throw new Error('User already invited');
    }
    
    const existingMember = await prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        user: { email },
      },
    });
    
    if (existingMember) {
      throw new Error('User is already a member');
    }
    
    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
    
    const invitation = await prisma.workspaceInvitation.create({
      data: {
        email,
        role,
        token,
        workspaceId,
        invitedById: inviterId,
        expiresAt,
      },
      include: {
        workspace: true,
      },
    });
    
    await sendInvitationEmail(email, invitation);
  
  // 🔔 NEW: Check if invited user exists and send notification
  const invitedUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, notifications: true },
  });
  
  if (invitedUser && invitedUser.notifications && invitation.workspace) {
    await notifyUser({
      userId: invitedUser.id,
      senderId: inviterId,
      type: 'WORKSPACE_INVITE',
      title: 'Workspace Invitation',
      message: `${inviter.user.name} invited you to join ${invitation.workspace.name}`,
      actionUrl: `/dashboard/workspaces/invitations/${token}`,
    });
  }
    
    return invitation;
  }
  
  // Accept invitation
  static async acceptInvitation(token: string, userId: string) {
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: { workspace: true },
    });
    
    if (!invitation) {
      throw new Error('Invalid invitation token');
    }
    
    if (invitation.status !== 'PENDING') {
      throw new Error('Invitation already used');
    }
    
    if (invitation.expiresAt < new Date()) {
      await prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Invitation expired');
    }
    
    // Get user email
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    
    if (user?.email !== invitation.email) {
      throw new Error('Invitation email does not match');
    }
    
    // Add user to workspace
    await prisma.workspaceMember.create({
      data: {
        userId,
        workspaceId: invitation.workspaceId,
        role: invitation.role,
      },
    });
    
    // Update invitation status
    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: 'ACCEPTED' },
    });
    
    if (invitation.invitedById && invitation.invitedById) {
    const inviter = await prisma.user.findUnique({
      where: { id: invitation.invitedById },
      select: { notifications: true },
    });
    
    if (inviter?.notifications && invitation.workspace) {
      await notifyUser({
        userId: invitation.invitedById,
        senderId: userId,
        type: 'MEMBER_JOINED',
        title: 'Invitation Accepted',
        message: `${user.name} accepted your invitation to ${invitation.workspace.name}`,
        actionUrl: `/dashboard/workspaces/${invitation.workspace.slug}`,
      });
    }
  }

   const admins = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: invitation.workspaceId,
      role: { in: ['OWNER', 'ADMIN'] },
      userId: { not: invitation.invitedById }, // Don't notify inviter again
    },
    include: {
      user: {
        select: {
          id: true,
          notifications: true,
        },
      },
    },
  });
  
  for (const admin of admins) {
    if (admin.user.notifications && invitation.workspace) {
      await notifyUser({
        userId: admin.userId,
        senderId: userId,
        type: 'MEMBER_JOINED',
        title: 'New Member Joined',
        message: `${user.name} joined ${invitation.workspace.name}`,
        actionUrl: `/dashboard/workspaces/${invitation.workspace.slug}/members`,
      });
    }
  }

    return invitation.workspace;
  }

static async getInvitationByToken(token: string) {
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            logo: true,
            color: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new Error('Invitation not found');
    }

    return invitation;
  }

  // In removeMember method
static async removeMember(
  workspaceId: string,
  removerId: string,
  memberId: string
) {
  // Check permissions
  const remover = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: removerId,
      role: { in: ['OWNER', 'ADMIN'] },
    },
    include: {
      user: { select: { name: true } },
    },
  });
  
  if (!remover) {
    throw new Error('Unauthorized');
  }
  
  // Get member info before deletion
  const member = await prisma.workspaceMember.findUnique({
    where: { id: memberId },
    include: {
      user: {
        select: { id: true, name: true, notifications: true },
      },
      workspace: {
        select: { name: true },
      },
    },
  });
  
  if (member) {
    await prisma.workspaceMember.delete({
      where: { id: memberId },
    });
    
    // 🔔 Notify the removed member
    if (member.user.notifications && member.workspace) {
      await notifyUser({
        userId: member.userId,
        senderId: removerId,
        type: 'MEMBER_REMOVED',
        title: 'Removed from Workspace',
        message: `You have been removed from ${member.workspace.name}`,
      });
    }
  }
}
  
  // Update member role
  // In updateMemberRole method
static async updateMemberRole(
  workspaceId: string,
  updaterId: string,
  memberId: string,
  role: WorkspaceRole
) {
  // Only owner can update roles
  const updater = await prisma.workspaceMember.findFirst({
    where: {
      workspaceId,
      userId: updaterId,
      role: 'OWNER',
    },
    include: {
      user: { select: { name: true } },
      workspace: { select: { name: true } },
    },
  });
  
  if (!updater) {
    throw new Error('Unauthorized');
  }
  
  const member = await prisma.workspaceMember.update({
    where: { id: memberId },
    data: { role },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          notifications: true,
        },
      },
    },
  });
  
  // 🔔 Notify the member about role change
  if (member.user.notifications && updater.workspace) {
    await notifyUser({
      userId: member.userId,
      senderId: updaterId,
      type: 'ROLE_UPDATED',
      title: 'Role Updated',
      message: `Your role in ${updater.workspace.name} has been changed to ${role}`,
      actionUrl: `/dashboard/workspaces/${workspaceId}`,
    });
  }
  
  return member;
}
  
  // Leave workspace
  static async leaveWorkspace(workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    
    if (!member) {
      throw new Error('Not a member of this workspace');
    }
    
    if (member.role === 'OWNER') {
      throw new Error('Owner cannot leave workspace. Transfer ownership first.');
    }
    
    await prisma.workspaceMember.delete({
      where: { id: member.id },
    });
  }
  
  // Get workspace statistics
  static async getStats(workspaceId: string, userId: string) {
    // Check access
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
    });
    
    if (!member) {
      throw new Error('Unauthorized');
    }
    
    const [
      totalProjects,
      totalTasks,
      totalMembers,
      completedTasks,
      overdueTasks,
    ] = await Promise.all([
      prisma.project.count({ where: { workspaceId } }),
      prisma.task.count({
        where: { project: { workspaceId } },
      }),
      prisma.workspaceMember.count({ where: { workspaceId } }),
      prisma.task.count({
        where: {
          project: { workspaceId },
          status: 'COMPLETED',
        },
      }),
      prisma.task.count({
        where: {
          project: { workspaceId },
          dueDate: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
    ]);
    
    return {
      totalProjects,
      totalTasks,
      totalMembers,
      completedTasks,
      overdueTasks,
      completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
    };
  }
}