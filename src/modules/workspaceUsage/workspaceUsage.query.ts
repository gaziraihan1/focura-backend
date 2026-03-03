import { prisma } from "../../index.js";
import { WorkspaceUsageAccess } from "./workspaceUsage.access.js";
import {
  bytesToMB,
  daysBetween,
  getDateRange,
  getDayBounds,
  getMonthRange,
} from "./workspaceUsage.utils.js";
import { PLAN_LIMITS } from "./workspaceUsage.types.js";
import type {
  WorkspaceUsageData,
  UsageSnapshot,
  FeatureUsageMetrics,
  PlanLimitsMetrics,
  ProjectActivityMetrics,
  UserEngagementMetrics,
  ResourceUsageMetrics,
  WorkspaceLoadMetrics,
  WorkspaceGrowthMetrics,
} from "./workspaceUsage.types.js";

export const WorkspaceUsageQuery = {

  async getWorkspaceUsage(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceUsageData> {
    const member = await WorkspaceUsageAccess.assertWorkspaceMember(
      userId,
      workspaceId,
    );
    const isAdmin = WorkspaceUsageAccess.isAdmin(member.role);

    const [workspace, members, files] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { plan: true, maxStorage: true },
      }),
      prisma.workspaceMember.findMany({
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
      }),
      prisma.file.findMany({
        where: { workspaceId },
        select: { id: true, size: true, uploadedById: true, projectId: true },
      }),
    ]);

    const [
      snapshot,
      projectActivity,
      userEngagement,
      resourceUsage,
      workspaceLoad,
      workspaceGrowth,
      featureUsage,
      planLimits,
    ] = await Promise.all([
      this.getUsageSnapshot(workspaceId, members, files),
      this.getProjectActivity(workspaceId),
      this.getUserEngagement(workspaceId, members, isAdmin),
      this.getResourceUsage(workspaceId, files, workspace?.maxStorage ?? 1024),
      this.getWorkspaceLoad(workspaceId, members, isAdmin),
      this.getWorkspaceGrowth(workspaceId),
      this.getFeatureUsage(workspaceId),
      this.getPlanLimits(workspaceId, workspace, members.length, files),
    ]);

    return {
      snapshot,
      projectActivity,
      userEngagement,
      resourceUsage,
      workspaceLoad,
      workspaceGrowth,
      featureUsage,
      planLimits,
      isAdmin,
    };
  },


  async getDailyActiveUsers(
    workspaceId: string,
    days: number,
  ): Promise<Array<{ date: string; count: number }>> {
    const dateRange = getDateRange(days);
    const windowStart = new Date(dateRange[0]);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(dateRange[dateRange.length - 1]);
    windowEnd.setHours(23, 59, 59, 999);

    const activities = await prisma.activity.findMany({
      where: {
        workspaceId,
        createdAt: { gte: windowStart, lte: windowEnd },
      },
      select: { userId: true, createdAt: true },
    });

    return dateRange.map((date) => {
      const { start, end } = getDayBounds(date);
      const uniqueUsers = new Set(
        activities
          .filter((a) => a.createdAt >= start && a.createdAt <= end)
          .map((a) => a.userId),
      );

      return {
        date: start.toISOString().split("T")[0],
        count: uniqueUsers.size,
      };
    });
  },


  async getUsageSnapshot(
    workspaceId: string,
    members: any[], // Pre-fetched
    files: any[], // Pre-fetched
  ): Promise<UsageSnapshot> {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalTasks, totalProjects, totalActivities, dauLastWeek] =
      await Promise.all([
        prisma.task.count({ where: { workspaceId } }),
        prisma.project.count({ where: { workspaceId } }),
        prisma.activity.count({
          where: { workspaceId, createdAt: { gte: oneWeekAgo } },
        }),
        this.getDailyActiveUsers(workspaceId, 7),
      ]);

    const totalMembers = members.length;
    const activeMembers = members.filter(
      (m) => m.user.lastLoginAt && m.user.lastLoginAt >= oneWeekAgo,
    ).length;

    const storageUsedMB = bytesToMB(files.reduce((sum, f) => sum + f.size, 0));

    const avgDailyUsers =
      dauLastWeek.length > 0
        ? Math.round(
            dauLastWeek.reduce((sum, d) => sum + d.count, 0) /
              dauLastWeek.length,
          )
        : 0;

    const engagementScore =
      totalMembers > 0
        ? Math.min(100, Math.round((activeMembers / totalMembers) * 100))
        : 0;

    return {
      totalMembers,
      activeMembers,
      totalTasks,
      totalProjects,
      storageUsedMB,
      activityEvents: totalActivities,
      avgDailyUsers,
      engagementScore,
    };
  },


  async getUserEngagement(
    workspaceId: string,
    members: any[], // Pre-fetched
    isAdmin: boolean,
  ): Promise<UserEngagementMetrics> {
    const dailyActiveUsers = await this.getDailyActiveUsers(workspaceId, 7);

    if (!isAdmin) {
      return {
        activeUsers: { online: 0, thisWeek: 0, thisMonth: 0 },
        inactiveUsers: [],
        collaborationIndex: [],
        dailyActiveUsers,
      };
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fourteenAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const activeThisWeek = members.filter(
      (m) => m.user.lastLoginAt && m.user.lastLoginAt >= oneWeekAgo,
    ).length;
    const activeThisMonth = members.filter(
      (m) => m.user.lastLoginAt && m.user.lastLoginAt >= oneMonthAgo,
    ).length;

    const inactiveUsers = members
      .filter((m) => !m.user.lastLoginAt || m.user.lastLoginAt < fourteenAgo)
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        lastActive: m.user.lastLoginAt,
        daysSinceActive: m.user.lastLoginAt
          ? Math.floor(
              (now.getTime() - m.user.lastLoginAt.getTime()) /
                (1000 * 60 * 60 * 24),
            )
          : 999,
      }))
      .sort((a, b) => b.daysSinceActive - a.daysSinceActive);

    const [commentCounts, tasksCounts, assigneeCounts] = await Promise.all([
      prisma.comment.groupBy({
        by: ["userId"],
        where: { task: { workspaceId } },
        _count: { userId: true },
      }),
      prisma.task.groupBy({
        by: ["createdById"],
        where: { workspaceId },
        _count: { createdById: true },
      }),
      prisma.taskAssignee.groupBy({
        by: ["userId"],
        where: { task: { workspaceId } },
        _count: { userId: true },
      }),
    ]);

    const commentMap = new Map(
      commentCounts.map((c) => [c.userId, c._count.userId]),
    );
    const taskMap = new Map(
      tasksCounts.map((t) => [t.createdById, t._count.createdById]),
    );
    const assigneeMap = new Map(
      assigneeCounts.map((a) => [a.userId, a._count.userId]),
    );

    const collaborationIndex = members
      .map((m) => {
        const commentsCount = commentMap.get(m.user.id) ?? 0;
        const tasksCreated = taskMap.get(m.user.id) ?? 0;
        const tasksAssigned = assigneeMap.get(m.user.id) ?? 0;

        return {
          userId: m.user.id,
          userName: m.user.name,
          userEmail: m.user.email,
          userImage: m.user.image,
          commentsCount,
          tasksCreated,
          tasksAssigned,
          collaborationScore:
            commentsCount * 3 + tasksCreated * 2 + tasksAssigned,
        };
      })
      .sort((a, b) => b.collaborationScore - a.collaborationScore);

    return {
      activeUsers: {
        online: 0,
        thisWeek: activeThisWeek,
        thisMonth: activeThisMonth,
      },
      inactiveUsers,
      collaborationIndex,
      dailyActiveUsers,
    };
  },


  async getFeatureUsage(workspaceId: string): Promise<FeatureUsageMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      tasksCreated,
      commentsAdded,
      timeEntriesLogged,
      filesUploaded,
      notifications,
    ] = await Promise.all([
      prisma.task.count({
        where: { workspaceId, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.comment.count({
        where: { task: { workspaceId }, createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.timeEntry.count({
        where: { task: { workspaceId }, startedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.file.count({
        where: { workspaceId, uploadedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.notification.count({
        where: {
          user: { workspaceMembers: { some: { workspaceId } } },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    const commentsWithMentions = await prisma.comment.findMany({
      where: {
        task: { workspaceId },
        content: { contains: "@" },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { content: true },
    });

    const mentionsUsed = commentsWithMentions.reduce(
      (sum, c) => sum + (c.content.match(/@\w+/g)?.length ?? 0),
      0,
    );

    return {
      tasksCreated,
      commentsAdded,
      timeEntriesLogged,
      filesUploaded,
      mentionsUsed,
      notificationsTriggered: notifications,
    };
  },


  async getPlanLimits(
    workspaceId: string,
    workspace: any, // Pre-fetched
    memberCount: number, // Pre-calculated
    files: any[], // Pre-fetched
  ): Promise<PlanLimitsMetrics> {
    if (!workspace) throw new Error("Workspace not found");

    const projectCount = await prisma.project.count({ where: { workspaceId } });

    const storageUsedMB = bytesToMB(files.reduce((sum, f) => sum + f.size, 0));
    const limits =
      PLAN_LIMITS[workspace.plan as keyof typeof PLAN_LIMITS] ??
      PLAN_LIMITS.FREE;

    return {
      currentPlan: workspace.plan,
      memberCount,
      memberLimit: limits.members,
      storageUsedMB,
      storageLimitMB: limits.storage,
      projectCount,
      projectLimit: limits.projects,
      automationCount: 0,
      automationLimit: limits.automations,
    };
  },


  async getProjectActivity(
    workspaceId: string,
  ): Promise<ProjectActivityMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const projects = await prisma.project.findMany({
      where: { workspaceId },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        _count: { select: { tasks: true } },
      },
    });

    if (projects.length === 0) {
      return { mostActive: [], lowActivity: [], tasksPerProjectTrend: [] };
    }

    const projectIds = projects.map((p) => p.id);

    const [commentsByProject, activitiesByProject] = await Promise.all([
      prisma.comment
        .groupBy({
          by: ["taskId"],
          where: { task: { projectId: { in: projectIds } } },
          _count: { id: true },
        })
        .then(async (counts) => {
          const taskIds = counts.map((c) => c.taskId);
          const tasks = await prisma.task.findMany({
            where: { id: { in: taskIds } },
            select: { id: true, projectId: true },
          });
          const taskProjectMap = new Map(tasks.map((t) => [t.id, t.projectId]));
          const projectCommentMap = new Map<string, number>();
          counts.forEach((c) => {
            const projId = taskProjectMap.get(c.taskId);
            if (projId) {
              projectCommentMap.set(
                projId,
                (projectCommentMap.get(projId) || 0) + c._count.id,
              );
            }
          });
          return projectCommentMap;
        }),
      prisma.activity
        .groupBy({
          by: ["taskId"],
          where: {
            task: { projectId: { in: projectIds } },
            createdAt: { gte: thirtyDaysAgo },
          },
          _count: { id: true },
        })
        .then(async (counts) => {
          const taskIds = counts.map((c) => c.taskId!).filter(Boolean);
          const tasks = await prisma.task.findMany({
            where: { id: { in: taskIds } },
            select: { id: true, projectId: true },
          });
          const taskProjectMap = new Map(tasks.map((t) => [t.id, t.projectId]));
          const projectActivityMap = new Map<string, number>();
          counts.forEach((c) => {
            if (c.taskId) {
              const projId = taskProjectMap.get(c.taskId);
              if (projId) {
                projectActivityMap.set(
                  projId,
                  (projectActivityMap.get(projId) || 0) + c._count.id,
                );
              }
            }
          });
          return projectActivityMap;
        }),
    ]);

    const lastActivities = await prisma.activity
      .findMany({
        where: { task: { projectId: { in: projectIds } } },
        select: { taskId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        distinct: ["taskId"],
      })
      .then(async (activities) => {
        const taskIds = activities.map((a) => a.taskId!).filter(Boolean);
        const tasks = await prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true, projectId: true },
        });
        const taskProjectMap = new Map(tasks.map((t) => [t.id, t.projectId]));
        const projectLastActivityMap = new Map<string, Date>();
        activities.forEach((a) => {
          if (a.taskId) {
            const projId = taskProjectMap.get(a.taskId);
            if (projId && !projectLastActivityMap.has(projId)) {
              projectLastActivityMap.set(projId, a.createdAt);
            }
          }
        });
        return projectLastActivityMap;
      });

    const projectsWithScores = projects.map((p) => {
      const commentCount = commentsByProject.get(p.id) ?? 0;
      const recentActivityCount = activitiesByProject.get(p.id) ?? 0;
      const lastActivity = lastActivities.get(p.id) ?? p.createdAt;

      return {
        id: p.id,
        name: p.name,
        color: p.color,
        activityScore:
          recentActivityCount * 5 + commentCount * 3 + p._count.tasks,
        taskCount: p._count.tasks,
        commentCount,
        lastActivity,
        daysSinceLastActivity: daysBetween(lastActivity, new Date()),
      };
    });

    const mostActive = [...projectsWithScores]
      .sort((a, b) => b.activityScore - a.activityScore)
      .slice(0, 10);

    const lowActivity = projectsWithScores
      .filter((p) => p.daysSinceLastActivity >= 14)
      .sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity)
      .slice(0, 10)
      .map(({ id, name, color, taskCount, daysSinceLastActivity }) => ({
        id,
        name,
        color,
        taskCount,
        daysSinceLastActivity,
      }));

    return { mostActive, lowActivity, tasksPerProjectTrend: [] };
  },


  async getResourceUsage(
    workspaceId: string,
    files: any[], // Pre-fetched
    maxStorageMB: number,
  ): Promise<ResourceUsageMetrics> {
    const projects = await prisma.project.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    });

    const filesByProject = new Map<string, typeof files>();
    files.forEach((f) => {
      if (f.projectId) {
        if (!filesByProject.has(f.projectId)) {
          filesByProject.set(f.projectId, []);
        }
        filesByProject.get(f.projectId)!.push(f);
      }
    });

    const totalStorageMB = bytesToMB(files.reduce((sum, f) => sum + f.size, 0));

    const storageByProject = projects
      .map((p) => {
        const projectFiles = filesByProject.get(p.id) || [];
        const storageMB = bytesToMB(
          projectFiles.reduce((s, f) => s + f.size, 0),
        );
        return {
          projectId: p.id,
          projectName: p.name,
          storageUsedMB: storageMB,
          fileCount: projectFiles.length,
          percentage:
            totalStorageMB > 0
              ? Math.round((storageMB / totalStorageMB) * 100)
              : 0,
        };
      })
      .filter((p) => p.fileCount > 0)
      .sort((a, b) => b.storageUsedMB - a.storageUsedMB)
      .slice(0, 10);

    // Group files by user
    const filesByUserId = new Map<string, typeof files>();
    files.forEach((f) => {
      if (!filesByUserId.has(f.uploadedById)) {
        filesByUserId.set(f.uploadedById, []);
      }
      filesByUserId.get(f.uploadedById)!.push(f);
    });

    const userIds = Array.from(filesByUserId.keys());
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    const filesByUser = users
      .map((u) => {
        const userFiles = filesByUserId.get(u.id) || [];
        return {
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          fileCount: userFiles.length,
          storageUsedMB: bytesToMB(userFiles.reduce((s, f) => s + f.size, 0)),
        };
      })
      .filter((u) => u.fileCount > 0)
      .sort((a, b) => b.storageUsedMB - a.storageUsedMB);

    return {
      storageByProject,
      filesByUser,
      totalStorage: {
        usedMB: totalStorageMB,
        totalMB: maxStorageMB,
        percentage: Math.min(
          100,
          Math.round((totalStorageMB / maxStorageMB) * 100),
        ),
      },
    };
  },


  async getWorkspaceLoad(
    workspaceId: string,
    members: any[], // Pre-fetched
    isAdmin: boolean,
  ): Promise<WorkspaceLoadMetrics> {
    if (!isAdmin) {
      return {
        tasksPerUser: [],
        projectsNearingDeadlines: [],
        averageTaskCompletion: { byUser: [], byProject: [] },
      };
    }

    const now = new Date();
    const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const assigneeCounts = await prisma.taskAssignee.groupBy({
      by: ["userId"],
      where: {
        task: { workspaceId, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      },
      _count: { userId: true },
    });

    const overdueTaskCounts = await prisma.taskAssignee.groupBy({
      by: ["userId"],
      where: {
        task: {
          workspaceId,
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          dueDate: { lt: now },
        },
      },
      _count: { userId: true },
    });

    const assigneeMap = new Map(
      assigneeCounts.map((a) => [a.userId, a._count.userId]),
    );
    const overdueMap = new Map(
      overdueTaskCounts.map((a) => [a.userId, a._count.userId]),
    );

    const tasksPerUser = members
      .map((m) => {
        const activeTasks = assigneeMap.get(m.user.id) ?? 0;
        const overdueTasks = overdueMap.get(m.user.id) ?? 0;
        const capacityLevel: WorkspaceLoadMetrics["tasksPerUser"][0]["capacityLevel"] =
          activeTasks === 0
            ? "UNDERUTILIZED"
            : activeTasks <= 5
              ? "OPTIMAL"
              : activeTasks <= 10
                ? "NEAR_CAPACITY"
                : "OVERLOADED";

        return {
          userId: m.user.id,
          userName: m.user.name,
          userEmail: m.user.email,
          userImage: m.user.image,
          activeTasks,
          overdueTasks,
          capacityLevel,
        };
      })
      .sort((a, b) => b.activeTasks - a.activeTasks);

    const nearingProjects = await prisma.project.findMany({
      where: {
        workspaceId,
        dueDate: { gte: now, lte: fourteenDaysOut },
        status: { notIn: ["COMPLETED", "ARCHIVED"] },
      },
      include: { tasks: { select: { id: true, status: true } } },
    });

    const projectsNearingDeadlines = nearingProjects
      .map((p) => {
        const total = p.tasks.length;
        const completed = p.tasks.filter(
          (t) => t.status === "COMPLETED",
        ).length;
        return {
          projectId: p.id,
          projectName: p.name,
          dueDate: p.dueDate!,
          daysRemaining: Math.ceil(
            (p.dueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
          completionPercentage:
            total > 0 ? Math.round((completed / total) * 100) : 0,
          status: p.status,
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    return {
      tasksPerUser,
      projectsNearingDeadlines,
      averageTaskCompletion: { byUser: [], byProject: [] },
    };
  },


  async getWorkspaceGrowth(
    workspaceId: string,
  ): Promise<WorkspaceGrowthMetrics> {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [newUsers, newProjects, newTasks] = await Promise.all([
      prisma.workspaceMember.count({
        where: { workspaceId, joinedAt: { gte: firstDayOfMonth } },
      }),
      prisma.project.count({
        where: { workspaceId, createdAt: { gte: firstDayOfMonth } },
      }),
      prisma.task.count({
        where: { workspaceId, createdAt: { gte: firstDayOfMonth } },
      }),
    ]);

    const monthRanges = getMonthRange(6);
    const trend = await Promise.all(
      monthRanges.map(async ({ start, end, label }) => {
        const [users, projects, tasks] = await Promise.all([
          prisma.workspaceMember.count({
            where: { workspaceId, joinedAt: { gte: start, lte: end } },
          }),
          prisma.project.count({
            where: { workspaceId, createdAt: { gte: start, lte: end } },
          }),
          prisma.task.count({
            where: { workspaceId, createdAt: { gte: start, lte: end } },
          }),
        ]);
        return { month: label, users, projects, tasks };
      }),
    );

    const [active, completed, archived] = await Promise.all([
      prisma.project.count({ where: { workspaceId, status: "ACTIVE" } }),
      prisma.project.count({ where: { workspaceId, status: "COMPLETED" } }),
      prisma.project.count({ where: { workspaceId, status: "ARCHIVED" } }),
    ]);

    return {
      thisMonth: { newUsers, newProjects, newTasks },
      trend,
      projectLifecycle: { created: newProjects, active, completed, archived },
    };
  },
};
