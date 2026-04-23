import { prisma } from "../../lib/prisma.js";
import {
  getPersonalQuotaUsage,
  getWorkspaceQuotaUsage,
  personalLimits,
  workspaceLimits,
  type UserPlan,
  type WorkspacePlan,
} from "./task.quota.service.js";

async function resolveUserPlan(userId: string): Promise<UserPlan> {
  // User's effective plan = highest plan across all workspaces they own
  const workspaces = await prisma.workspace.findMany({
    where: { ownerId: userId },
    select: { plan: true },
  });

  const RANK: Record<string, number> = {
    FREE: 0,
    PRO: 1,
    BUSINESS: 2,
    ENTERPRISE: 3,
  };
  let highest = "FREE";
  for (const ws of workspaces) {
    if ((RANK[ws.plan] ?? 0) > (RANK[highest] ?? 0)) highest = ws.plan;
  }
  return highest === "PRO" ? "PRO" : "FREE";
}

async function resolveWorkspacePlan(
  workspaceId: string,
): Promise<WorkspacePlan> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });
  const p = ws?.plan as string | undefined;
  if (p === "ENTERPRISE") return "ENTERPRISE";
  if (p === "BUSINESS") return "BUSINESS";
  if (p === "PRO") return "PRO";
  return "FREE";
}

export interface PersonalQuotaInfo {
  plan: UserPlan;
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  resetAt: Date;
  perMinuteLimit: number | null;
}

export interface MemberQuotaInfo {
  userId: string;
  name: string | null;
  image: string | null;
  email: string;
  usedToday: number;
  memberLimit: number | null;
  remaining: number | null;
}

export interface WorkspaceQuotaInfo {
  plan: WorkspacePlan;
  dailyWorkspaceLimit: number | null;
  dailyPerMemberLimit: number | null;
  workspaceUsedToday: number;
  workspaceRemaining: number | null;
  perMinuteLimit: number | null;
  isUnlimited: boolean;
  resetAt: Date;
  members: MemberQuotaInfo[];
}

export async function getPersonalQuotaInfo(
  userId: string,
): Promise<PersonalQuotaInfo> {
  const plan = await resolveUserPlan(userId);
  const limits = personalLimits(plan);

  const usage = await getPersonalQuotaUsage(userId, plan);

  return {
    plan,
    dailyLimit: usage.limit,
    usedToday: usage.usedToday,
    remaining: usage.remaining,
    resetAt: usage.resetAt,
    perMinuteLimit: null,
  };
}

export async function getWorkspaceQuotaInfo(
  workspaceId: string,
  requesterId: string,
): Promise<WorkspaceQuotaInfo> {
  const [plan, allMemberships, requesterMembership] = await Promise.all([
    resolveWorkspacePlan(workspaceId),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: requesterId },
      select: { role: true },
    }),
  ]);

  const memberCount = allMemberships.length;
  const limits = workspaceLimits(plan, memberCount);
  const isAdmin =
    requesterMembership?.role === "OWNER" ||
    requesterMembership?.role === "ADMIN";

  const memberIdsToFetch = isAdmin
    ? allMemberships.map((m) => m.userId)
    : [requesterId];

  const usage = await getWorkspaceQuotaUsage(
    workspaceId,
    requesterId,
    plan,
    memberCount,
    memberIdsToFetch,
  );

  let members: MemberQuotaInfo[] = [];
  if (isAdmin && !limits.isUnlimited) {
    const usageMap = new Map(
      usage.perMemberBreakdown.map((m) => [m.userId, m]),
    );

    members = allMemberships.map((membership) => {
      const memberUsage = usageMap.get(membership.userId);
      return {
        userId: membership.userId,
        name: (membership as any).user?.name ?? null,
        image: (membership as any).user?.image ?? null,
        email: (membership as any).user?.email ?? "",
        usedToday: memberUsage?.usedToday ?? 0,
        memberLimit: limits.dailyPerMember,
        remaining: memberUsage?.remaining ?? limits.dailyPerMember,
      };
    });
  }

  return {
    plan,
    dailyWorkspaceLimit: limits.dailyWorkspaceTotal,
    dailyPerMemberLimit: limits.dailyPerMember,
    workspaceUsedToday: usage.workspaceUsedToday,
    workspaceRemaining: usage.workspaceRemaining,
    perMinuteLimit: limits.perMinute,
    isUnlimited: limits.isUnlimited,
    resetAt: usage.resetAt,
    members,
  };
}
