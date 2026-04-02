import { prisma } from '../index.js';
import type {
  AdminStats,
  AdminWorkspace,
  AdminWorkspaceDetail,
  AdminUser,
  AdminProject,
  AdminActivity,
  AdminPaginationParams,
  PaginatedAdminResult,
} from './admin.types.js';

function paginate(page = 1, pageSize = 20) {
  const p  = Math.max(1, page);
  const ps = Math.min(100, Math.max(1, pageSize));
  return { page: p, pageSize: ps, skip: (p - 1) * ps };
}

function buildPagination(page: number, pageSize: number, totalCount: number) {
  const totalPages = Math.ceil(totalCount / pageSize);
  return { page, pageSize, totalCount, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

export const AdminRepository = {

  // ── Overview stats — all counts in one Promise.all, zero N+1 ──────────────
  async getStats(): Promise<AdminStats> {
    const [
      totalUsers,
      totalWorkspaces,
      totalProjects,
      totalTasks,
      totalAnnouncements,
      plans,
      featureRequests,
      recentSignups,
      recentWorkspaces,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.project.count(),
      prisma.task.count(),
      prisma.announcement.count(),
      prisma.workspace.groupBy({
        by:      ['plan'],
        _count:  { plan: true },
        orderBy: { _count: { plan: 'desc' } },
      }),
      prisma.featureRequest.groupBy({
        by:     ['status'],
        _count: { status: true },
      }),
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take:    5,
        select:  { id: true, name: true, email: true, image: true, createdAt: true },
      }),
      prisma.workspace.findMany({
        orderBy: { createdAt: 'desc' },
        take:    5,
        select: {
          id: true, name: true, plan: true, createdAt: true,
          owner:  { select: { id: true, name: true, email: true } },
          _count: { select: { members: true, projects: true } },
        },
      }),
    ]);

    // Flatten feature request group-by into named fields
    const frMap = Object.fromEntries(
      featureRequests.map((f) => [f.status, f._count.status]),
    );

    return {
      totals: {
        users:         totalUsers,
        workspaces:    totalWorkspaces,
        projects:      totalProjects,
        tasks:         totalTasks,
        announcements: totalAnnouncements,
      },
      plans: plans.map((p) => ({ plan: p.plan, count: p._count.plan })),
      featureRequests: {
        pending:   frMap['PENDING']   ?? 0,
        approved:  frMap['APPROVED']  ?? 0,
        planned:   frMap['PLANNED']   ?? 0,
        completed: frMap['COMPLETED'] ?? 0,
        rejected:  frMap['REJECTED']  ?? 0,
      },
      recentSignups:    recentSignups.map((u) => ({ ...u, name: u.name ?? 'Unknown' })),
      recentWorkspaces: recentWorkspaces as AdminStats['recentWorkspaces'],
    };
  },

  // ── Workspaces list ────────────────────────────────────────────────────────
  async getWorkspaces(
    params: AdminPaginationParams,
  ): Promise<PaginatedAdminResult<AdminWorkspace>> {
    const { page, pageSize, skip } = paginate(params.page, params.pageSize);

    const where = params.search
      ? {
          OR: [
            { name:  { contains: params.search, mode: 'insensitive' as const } },
            { slug:  { contains: params.search, mode: 'insensitive' as const } },
            { owner: { email: { contains: params.search, mode: 'insensitive' as const } } },
          ],
        }
      : {};

    const [rows, totalCount] = await Promise.all([
      prisma.workspace.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, name: true, slug: true, plan: true, createdAt: true,
          owner:  { select: { id: true, name: true, email: true, image: true } },
          _count: { select: { members: true, projects: true } },
        },
      }),
      prisma.workspace.count({ where }),
    ]);

    // Fetch task counts per workspace in one query (avoid N+1)
    const workspaceIds = rows.map((r) => r.id);
    const taskCounts   = await prisma.task.groupBy({
      by:    ['workspaceId'],
      where: { workspaceId: { in: workspaceIds } },
      _count: { id: true },
    });
    const taskMap = Object.fromEntries(taskCounts.map((t) => [t.workspaceId, t._count.id]));

    return {
      data: rows.map((r) => ({
        ...r,
        owner: { ...r.owner, name: r.owner.name ?? 'Unknown' },
        _count: { ...r._count, tasks: taskMap[r.id] ?? 0 },
      })) as AdminWorkspace[],
      pagination: buildPagination(page, pageSize, totalCount),
    };
  },

  // ── Single workspace detail ────────────────────────────────────────────────
  async getWorkspaceDetail(id: string): Promise<AdminWorkspaceDetail | null> {
    const raw = await prisma.workspace.findUnique({
      where: { id },
      select: {
        id: true, name: true, slug: true, plan: true,
        createdAt: true, updatedAt: true,
        owner: { select: { id: true, name: true, email: true, image: true } },
        members: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true, role: true, joinedAt: true,
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        projects: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, name: true, slug: true,
            status: true, priority: true, createdAt: true,
            _count: { select: { tasks: true, members: true } },
          },
        },
        _count: { select: { members: true, projects: true } },
      },
    });

    if (!raw) return null;

    return {
      ...raw,
      owner: { ...raw.owner, name: raw.owner.name ?? 'Unknown' },
      members: raw.members.map((m) => ({
        ...m,
        role: m.role as string,
        user: { ...m.user, name: m.user.name ?? 'Unknown' },
      })),
    } as AdminWorkspaceDetail;
  },

  // ── Users list ─────────────────────────────────────────────────────────────
  async getUsers(
    params: AdminPaginationParams,
  ): Promise<PaginatedAdminResult<AdminUser>> {
    const { page, pageSize, skip } = paginate(params.page, params.pageSize);

    const where = params.search
      ? {
          OR: [
            { name:  { contains: params.search, mode: 'insensitive' as const } },
            { email: { contains: params.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [rows, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, name: true, email: true,
          image: true, role: true, createdAt: true,
          _count: { select: { workspaces: true, workspaceMember: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        ...r,
        name: r.name ?? 'Unknown',
      })) as AdminUser[],
      pagination: buildPagination(page, pageSize, totalCount),
    };
  },

  // ── Projects list ──────────────────────────────────────────────────────────
  async getProjects(
    params: AdminPaginationParams & { workspaceId?: string },
  ): Promise<PaginatedAdminResult<AdminProject>> {
    const { page, pageSize, skip } = paginate(params.page, params.pageSize);

    const where = {
      ...(params.workspaceId && { workspaceId: params.workspaceId }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' as const } },
          { slug: { contains: params.search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [rows, totalCount] = await Promise.all([
      prisma.project.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, name: true, slug: true,
          status: true, priority: true, createdAt: true,
          workspace: { select: { id: true, name: true, slug: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          _count:    { select: { tasks: true, members: true } },
        },
      }),
      prisma.project.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        ...r,
        createdBy: { ...r.createdBy, name: r.createdBy.name ?? 'Unknown' },
      })) as AdminProject[],
      pagination: buildPagination(page, pageSize, totalCount),
    };
  },

  // ── Activity feed ──────────────────────────────────────────────────────────
  async getActivity(
    params: AdminPaginationParams,
  ): Promise<PaginatedAdminResult<AdminActivity>> {
    const { page, pageSize, skip } = paginate(params.page, params.pageSize);

    const [rows, totalCount] = await Promise.all([
      prisma.activity.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, action: true, entityType: true,
          entityId: true, createdAt: true, metadata: true,
          user:      { select: { id: true, name: true, email: true, image: true } },
          workspace: { select: { id: true, name: true } },
        },
      }),
      prisma.activity.count(),
    ]);

    return {
      data: rows.map((r) => ({
        ...r,
        user: { ...r.user, name: r.user.name ?? 'Unknown' },
        workspace: r.workspace ?? null,
      })) as AdminActivity[],
      pagination: buildPagination(page, pageSize, totalCount),
    };
  },
};