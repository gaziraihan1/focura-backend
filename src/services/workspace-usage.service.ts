// server/services/workspace-usage.service.ts
import { prisma } from '../index.js';

export interface WorkspaceUsageData {
  projectActivity: ProjectActivityMetrics;
  userEngagement: UserEngagementMetrics;
  resourceUsage: ResourceUsageMetrics;
  workspaceLoad: WorkspaceLoadMetrics;
  workspaceGrowth: WorkspaceGrowthMetrics;
  isAdmin: boolean;
}

export interface ProjectActivityMetrics {
  mostActive: Array<{
    id: string;
    name: string;
    color: string | null;
    activityScore: number;
    taskCount: number;
    commentCount: number;
    lastActivity: Date;
  }>;
  lowActivity: Array<{
    id: string;
    name: string;
    color: string | null;
    taskCount: number;
    daysSinceLastActivity: number;
  }>;
  tasksPerProjectTrend: Array<{
    projectId: string;
    projectName: string;
    trend: Array<{ date: string; count: number }>;
  }>;
}

export interface UserEngagementMetrics {
  activeUsers: {
    online: number;
    thisWeek: number;
    thisMonth: number;
  };
  inactiveUsers: Array<{
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    lastActive: Date | null;
    daysSinceActive: number;
  }>;
  collaborationIndex: Array<{
    userId: string;
    userName: string | null;
    userEmail: string;
    userImage: string | null;
    commentsCount: number;
    tasksCreated: number;
    tasksAssigned: number;
    collaborationScore: number;
  }>;
}

export interface ResourceUsageMetrics {
  storageByProject: Array<{
    projectId: string;
    projectName: string;
    storageUsedMB: number;
    fileCount: number;
    percentage: number;
  }>;
  filesByUser: Array<{
    userId: string;
    userName: string | null;
    userEmail: string;
    fileCount: number;
    storageUsedMB: number;
  }>;
  totalStorage: {
    usedMB: number;
    totalMB: number;
    percentage: number;
  };
}

export interface WorkspaceLoadMetrics {
  tasksPerUser: Array<{
    userId: string;
    userName: string | null;
    userEmail: string;
    userImage: string | null;
    activeTasks: number;
    overdueTasks: number;
    capacityLevel: 'UNDERUTILIZED' | 'OPTIMAL' | 'NEAR_CAPACITY' | 'OVERLOADED';
  }>;
  projectsNearingDeadlines: Array<{
    projectId: string;
    projectName: string;
    dueDate: Date;
    daysRemaining: number;
    completionPercentage: number;
    status: string;
  }>;
  averageTaskCompletion: {
    byUser: Array<{
      userId: string;
      userName: string | null;
      completionRate: number;
      avgCompletionDays: number;
    }>;
    byProject: Array<{
      projectId: string;
      projectName: string;
      completionRate: number;
      avgCompletionDays: number;
    }>;
  };
}

export interface WorkspaceGrowthMetrics {
  thisMonth: {
    newUsers: number;
    newProjects: number;
    newTasks: number;
  };
  trend: Array<{
    month: string;
    users: number;
    projects: number;
    tasks: number;
  }>;
  projectLifecycle: {
    created: number;
    active: number;
    completed: number;
    archived: number;
  };
}

export class WorkspaceUsageService {
  // Check if user is admin
  static async isWorkspaceAdmin(userId: string, workspaceId: string): Promise<boolean> {
    const member = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    return member?.role === 'OWNER' || member?.role === 'ADMIN';
  }

  // Get all workspace usage metrics
  static async getWorkspaceUsage(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceUsageData> {
    // Verify access
    const member = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!member) {
      throw new Error('You do not have access to this workspace');
    }

    const isAdmin = member.role === 'OWNER' || member.role === 'ADMIN';

    // Fetch all metrics in parallel
    const [
      projectActivity,
      userEngagement,
      resourceUsage,
      workspaceLoad,
      workspaceGrowth,
    ] = await Promise.all([
      this.getProjectActivity(workspaceId),
      this.getUserEngagement(workspaceId, isAdmin),
      this.getResourceUsage(workspaceId),
      this.getWorkspaceLoad(workspaceId, isAdmin),
      this.getWorkspaceGrowth(workspaceId),
    ]);

    return {
      projectActivity,
      userEngagement,
      resourceUsage,
      workspaceLoad,
      workspaceGrowth,
      isAdmin,
    };
  }

  // 1. Project Activity Metrics
  static async getProjectActivity(workspaceId: string): Promise<ProjectActivityMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get all projects with activity metrics
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      include: {
        tasks: {
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    // Calculate activity scores
    const projectsWithScores = await Promise.all(
      projects.map(async (project) => {
        // Get comment count
        const commentCount = await prisma.comment.count({
          where: {
            task: {
              projectId: project.id,
            },
          },
        });

        // Get recent activity count
        const recentActivityCount = await prisma.activity.count({
          where: {
            entityType: 'PROJECT',
            entityId: project.id,
            createdAt: { gte: thirtyDaysAgo },
          },
        });

        // Get last activity
        const lastActivity = await prisma.activity.findFirst({
          where: {
            OR: [
              { entityType: 'PROJECT', entityId: project.id },
              { task: { projectId: project.id } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });

        // Calculate activity score (weighted)
        const activityScore =
          recentActivityCount * 5 +
          commentCount * 3 +
          project._count.tasks * 1;

        const daysSinceLastActivity = lastActivity
          ? Math.floor(
              (Date.now() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            )
          : 999;

        return {
          id: project.id,
          name: project.name,
          color: project.color,
          activityScore,
          taskCount: project._count.tasks,
          commentCount,
          lastActivity: lastActivity?.createdAt || project.createdAt,
          daysSinceLastActivity,
        };
      })
    );

    // Most active (top 10)
    const mostActive = projectsWithScores
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 10);

    // Low activity (projects with no activity in 14+ days)
    const lowActivity = projectsWithScores
      .filter((p) => p.daysSinceLastActivity >= 14)
      .sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity)
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        taskCount: p.taskCount,
        daysSinceLastActivity: p.daysSinceLastActivity,
      }));

    // Tasks per project trend (last 30 days)
    const tasksPerProjectTrend = await Promise.all(
      projects.slice(0, 5).map(async (project) => {
        const trend = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const startOfDay = new Date(date.setHours(0, 0, 0, 0));
          const endOfDay = new Date(date.setHours(23, 59, 59, 999));

          const count = await prisma.task.count({
            where: {
              projectId: project.id,
              createdAt: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          });

          trend.push({
            date: startOfDay.toISOString().split('T')[0],
            count,
          });
        }

        return {
          projectId: project.id,
          projectName: project.name,
          trend,
        };
      })
    );

    return {
      mostActive,
      lowActivity,
      tasksPerProjectTrend,
    };
  }

  // 2. User Engagement Metrics
  static async getUserEngagement(
    workspaceId: string,
    isAdmin: boolean
  ): Promise<UserEngagementMetrics> {
    if (!isAdmin) {
      return {
        activeUsers: { online: 0, thisWeek: 0, thisMonth: 0 },
        inactiveUsers: [],
        collaborationIndex: [],
      };
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get workspace members
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            lastLoginAt: true,
          },
        },
      },
    });

    // Active users count
    const activeThisWeek = members.filter(
      (m) => m.user.lastLoginAt && m.user.lastLoginAt >= oneWeekAgo
    ).length;

    const activeThisMonth = members.filter(
      (m) => m.user.lastLoginAt && m.user.lastLoginAt >= oneMonthAgo
    ).length;

    // Inactive users (14+ days)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const inactiveUsers = members
      .filter((m) => !m.user.lastLoginAt || m.user.lastLoginAt < fourteenDaysAgo)
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        lastActive: m.user.lastLoginAt,
        daysSinceActive: m.user.lastLoginAt
          ? Math.floor((now.getTime() - m.user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24))
          : 999,
      }))
      .sort((a, b) => b.daysSinceActive - a.daysSinceActive);

    // Collaboration index
    const collaborationIndex = await Promise.all(
      members.map(async (member) => {
        const [commentsCount, tasksCreated, tasksAssigned] = await Promise.all([
          prisma.comment.count({
            where: {
              userId: member.user.id,
              task: { workspaceId },
            },
          }),
          prisma.task.count({
            where: {
              createdById: member.user.id,
              workspaceId,
            },
          }),
          prisma.taskAssignee.count({
            where: {
              userId: member.user.id,
              task: { workspaceId },
            },
          }),
        ]);

        const collaborationScore = commentsCount * 3 + tasksCreated * 2 + tasksAssigned * 1;

        return {
          userId: member.user.id,
          userName: member.user.name,
          userEmail: member.user.email,
          userImage: member.user.image,
          commentsCount,
          tasksCreated,
          tasksAssigned,
          collaborationScore,
        };
      })
    );

    return {
      activeUsers: {
        online: 0, // Would need WebSocket tracking
        thisWeek: activeThisWeek,
        thisMonth: activeThisMonth,
      },
      inactiveUsers,
      collaborationIndex: collaborationIndex.sort((a, b) => b.collaborationScore - a.collaborationScore),
    };
  }

  // 3. Resource Usage Metrics
  static async getResourceUsage(workspaceId: string): Promise<ResourceUsageMetrics> {
    // Get workspace plan limits
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { maxStorage: true },
    });

    const maxStorageMB = workspace?.maxStorage || 1024;

    // Storage by project
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      include: {
        files: {
          select: {
            size: true,
          },
        },
      },
    });

    const totalStorageBytes = projects.reduce(
      (sum, p) => sum + p.files.reduce((s, f) => s + f.size, 0),
      0
    );
    const totalStorageMB = totalStorageBytes / (1024 * 1024);

    const storageByProject = projects
      .map((p) => {
        const storageBytes = p.files.reduce((sum, f) => sum + f.size, 0);
        const storageMB = storageBytes / (1024 * 1024);

        return {
          projectId: p.id,
          projectName: p.name,
          storageUsedMB: Math.round(storageMB * 100) / 100,
          fileCount: p.files.length,
          percentage: totalStorageMB > 0 ? Math.round((storageMB / totalStorageMB) * 100) : 0,
        };
      })
      .sort((a, b) => b.storageUsedMB - a.storageUsedMB)
      .slice(0, 10);

    // Files by user
    const usersWithFiles = await prisma.user.findMany({
      where: {
        workspaceMembers: {
          some: { workspaceId },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        files: {
          where: { workspaceId },
          select: {
            size: true,
          },
        },
      },
    });

    const filesByUser = usersWithFiles
      .map((u) => {
        const storageBytes = u.files.reduce((sum, f) => sum + f.size, 0);
        const storageMB = storageBytes / (1024 * 1024);

        return {
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          fileCount: u.files.length,
          storageUsedMB: Math.round(storageMB * 100) / 100,
        };
      })
      .filter((u) => u.fileCount > 0)
      .sort((a, b) => b.storageUsedMB - a.storageUsedMB);

    return {
      storageByProject,
      filesByUser,
      totalStorage: {
        usedMB: Math.round(totalStorageMB * 100) / 100,
        totalMB: maxStorageMB,
        percentage: Math.round((totalStorageMB / maxStorageMB) * 100),
      },
    };
  }

  // Continue in next part...
  // 4. Workspace Load Metrics
static async getWorkspaceLoad(
  workspaceId: string,
  isAdmin: boolean
): Promise<WorkspaceLoadMetrics> {
  if (!isAdmin) {
    return {
      tasksPerUser: [],
      projectsNearingDeadlines: [],
      averageTaskCompletion: { byUser: [], byProject: [] },
    };
  }

  const now = new Date();

  // Tasks per user with capacity assessment
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          assignedTasks: {
            where: {
              task: {
                workspaceId,
                status: { notIn: ['COMPLETED', 'CANCELLED'] },
              },
            },
            select: {
              task: {
                select: {
                  id: true,
                  dueDate: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const tasksPerUser = members.map((member) => {
    const activeTasks = member.user.assignedTasks.length;
    const overdueTasks = member.user.assignedTasks.filter(
      (a) => a.task.dueDate && a.task.dueDate < now
    ).length;

    let capacityLevel: 'UNDERUTILIZED' | 'OPTIMAL' | 'NEAR_CAPACITY' | 'OVERLOADED';
    if (activeTasks === 0) capacityLevel = 'UNDERUTILIZED';
    else if (activeTasks <= 5) capacityLevel = 'OPTIMAL';
    else if (activeTasks <= 10) capacityLevel = 'NEAR_CAPACITY';
    else capacityLevel = 'OVERLOADED';

    return {
      userId: member.user.id,
      userName: member.user.name,
      userEmail: member.user.email,
      userImage: member.user.image,
      activeTasks,
      overdueTasks,
      capacityLevel,
    };
  });

  // Projects nearing deadlines (next 14 days)
  const fourteenDaysFromNow = new Date();
  fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

  const projects = await prisma.project.findMany({
    where: {
      workspaceId,
      dueDate: {
        gte: now,
        lte: fourteenDaysFromNow,
      },
      status: { notIn: ['COMPLETED', 'ARCHIVED'] },
    },
    include: {
      tasks: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const projectsNearingDeadlines = projects.map((p) => {
    const totalTasks = p.tasks.length;
    const completedTasks = p.tasks.filter((t) => t.status === 'COMPLETED').length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const daysRemaining = Math.ceil(
      (p.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      projectId: p.id,
      projectName: p.name,
      dueDate: p.dueDate!,
      daysRemaining,
      completionPercentage,
      status: p.status,
    };
  });

  // Average task completion
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // By user
  const userCompletionData = await Promise.all(
    members.map(async (member) => {
      const completedTasks = await prisma.task.findMany({
        where: {
          workspaceId,
          assignees: {
            some: { userId: member.user.id },
          },
          status: 'COMPLETED',
          completedAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
          completedAt: true,
        },
      });

      const totalTasks = await prisma.task.count({
        where: {
          workspaceId,
          assignees: {
            some: { userId: member.user.id },
          },
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

      const avgCompletionDays =
        completedTasks.length > 0
          ? Math.round(
              completedTasks.reduce((sum, t) => {
                const days = (t.completedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                return sum + days;
              }, 0) / completedTasks.length
            )
          : 0;

      return {
        userId: member.user.id,
        userName: member.user.name,
        completionRate,
        avgCompletionDays,
      };
    })
  );

  // By project
  const allProjects = await prisma.project.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
    },
  });

  const projectCompletionData = await Promise.all(
    allProjects.map(async (project) => {
      const completedTasks = await prisma.task.findMany({
        where: {
          projectId: project.id,
          status: 'COMPLETED',
          completedAt: { gte: thirtyDaysAgo },
        },
        select: {
          createdAt: true,
          completedAt: true,
        },
      });

      const totalTasks = await prisma.task.count({
        where: {
          projectId: project.id,
          createdAt: { gte: thirtyDaysAgo },
        },
      });

      const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

      const avgCompletionDays =
        completedTasks.length > 0
          ? Math.round(
              completedTasks.reduce((sum, t) => {
                const days = (t.completedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24);
                return sum + days;
              }, 0) / completedTasks.length
            )
          : 0;

      return {
        projectId: project.id,
        projectName: project.name,
        completionRate,
        avgCompletionDays,
      };
    })
  );

  return {
    tasksPerUser: tasksPerUser.sort((a, b) => b.activeTasks - a.activeTasks),
    projectsNearingDeadlines: projectsNearingDeadlines.sort((a, b) => a.daysRemaining - b.daysRemaining),
    averageTaskCompletion: {
      byUser: userCompletionData.sort((a, b) => b.completionRate - a.completionRate),
      byProject: projectCompletionData.sort((a, b) => b.completionRate - a.completionRate),
    },
  };
}

// 5. Workspace Growth Metrics
static async getWorkspaceGrowth(workspaceId: string): Promise<WorkspaceGrowthMetrics> {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // This month's new additions
  const [newUsers, newProjects, newTasks] = await Promise.all([
    prisma.workspaceMember.count({
      where: {
        workspaceId,
        joinedAt: { gte: firstDayOfMonth },
      },
    }),
    prisma.project.count({
      where: {
        workspaceId,
        createdAt: { gte: firstDayOfMonth },
      },
    }),
    prisma.task.count({
      where: {
        workspaceId,
        createdAt: { gte: firstDayOfMonth },
      },
    }),
  ]);

  // 6-month trend
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const [users, projects, tasks] = await Promise.all([
      prisma.workspaceMember.count({
        where: {
          workspaceId,
          joinedAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),
      prisma.project.count({
        where: {
          workspaceId,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),
      prisma.task.count({
        where: {
          workspaceId,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      }),
    ]);

    trend.push({
      month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
      users,
      projects,
      tasks,
    });
  }

  // Project lifecycle
  const [created, active, completed, archived] = await Promise.all([
    prisma.project.count({
      where: {
        workspaceId,
        createdAt: { gte: firstDayOfMonth },
      },
    }),
    prisma.project.count({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
    }),
    prisma.project.count({
      where: {
        workspaceId,
        status: 'COMPLETED',
      },
    }),
    prisma.project.count({
      where: {
        workspaceId,
        status: 'ARCHIVED',
      },
    }),
  ]);

  return {
    thisMonth: {
      newUsers,
      newProjects,
      newTasks,
    },
    trend,
    projectLifecycle: {
      created,
      active,
      completed,
      archived,
    },
  };
}
}