import { prisma } from '../../index.js';
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilterParams,
  PaginatedAnnouncementsResult,
  AnnouncementResult,
} from './announcement.types.js';

// ─── Include shape ────────────────────────────────────────────────────────────
// targets are only needed for PRIVATE announcements — we always include them
// but Prisma batches this in 2 queries total (not N+1), so it's fine.

const announcementInclude = {
  createdBy: { select: { id: true, name: true, image: true } },
  project:   { select: { id: true, name: true } },
  targets: {
    select: {
      userId: true,
      user:   { select: { id: true, name: true, image: true } },
    },
  },
} as const;

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapAnnouncement(raw: any): AnnouncementResult {
  return {
    id:          raw.id,
    title:       raw.title,
    content:     raw.content,
    visibility:  raw.visibility,
    isPinned:    raw.isPinned,
    createdAt:   raw.createdAt,
    updatedAt:   raw.updatedAt,
    workspaceId: raw.workspaceId,
    projectId:   raw.projectId   ?? null,
    createdById: raw.createdById,
    project:     raw.project     ?? null,
    createdBy: {
      id:    raw.createdBy.id,
      name:  raw.createdBy.name  ?? 'Unknown',
      image: raw.createdBy.image ?? null,
    },
    targets: raw.targets.map((t: any) => ({
      userId: t.userId,
      user: {
        id:    t.user.id,
        name:  t.user.name  ?? 'Unknown',
        image: t.user.image ?? null,
      },
    })),
  };
}

// ─── Access filter factory ────────────────────────────────────────────────────
// Extracted so it's reused identically in findMany + count

function buildAccessFilter(
  userId:     string,
  visibility: AnnouncementFilterParams['visibility'],
) {
  if (visibility === 'PRIVATE') {
    return {
      visibility: 'PRIVATE' as const,
      OR: [
        { createdById: userId },
        { targets: { some: { userId } } },
      ],
    };
  }
  if (visibility === 'PUBLIC') {
    return { visibility: 'PUBLIC' as const };
  }
  // ALL — public + private where user is creator or target
  return {
    OR: [
      { visibility: 'PUBLIC' as const },
      {
        visibility: 'PRIVATE' as const,
        OR: [
          { createdById: userId },
          { targets: { some: { userId } } },
        ],
      },
    ],
  };
}

// ─── Project membership filter ────────────────────────────────────────────────
// projectId = string  → that project only
// projectId = null    → workspace-wide only (no project)
// projectId undefined → all (workspace-wide + joined projects)

function buildProjectFilter(
  userId:    string,
  projectId: string | null | undefined,
) {
  if (projectId !== undefined) {
    // specific project or workspace-wide only
    return { projectId };
  }
  // All: workspace-wide always visible +
  // project announcements only for projects the user belongs to
  return {
    OR: [
      { projectId: null },
      {
        projectId: { not: null },
        project:   { members: { some: { userId } } },
      },
    ],
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

export const AnnouncementRepository = {
  async create(input: CreateAnnouncementInput): Promise<AnnouncementResult> {
    const raw = await prisma.announcement.create({
      data: {
        title:       input.title,
        content:     input.content,
        visibility:  input.visibility,
        isPinned:    input.isPinned ?? false,
        workspaceId: input.workspaceId,
        projectId:   input.projectId ?? null,
        createdById: input.createdById,
        ...(input.visibility === 'PRIVATE' &&
          input.targetIds?.length && {
            targets: { create: input.targetIds.map((userId) => ({ userId })) },
          }),
      },
      include: announcementInclude,
    });
    return mapAnnouncement(raw);
  },

  async findById(id: string): Promise<AnnouncementResult | null> {
    const raw = await prisma.announcement.findUnique({
      where:   { id },
      include: announcementInclude,
    });
    return raw ? mapAnnouncement(raw) : null;
  },

  async findMany(params: AnnouncementFilterParams): Promise<PaginatedAnnouncementsResult> {
    const page     = Math.max(1, params.page     ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
    const skip     = (page - 1) * pageSize;

    const where = {
      workspaceId: params.workspaceId,
      ...(params.isPinned !== undefined && { isPinned: params.isPinned }),
      ...buildAccessFilter(params.userId, params.visibility),
      ...buildProjectFilter(params.userId, params.projectId),
    };

    // Single round-trip: data + count in parallel
    const [rows, totalCount] = await Promise.all([
      prisma.announcement.findMany({
        where,
        include: announcementInclude,
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.announcement.count({ where }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return {
      data: rows.map(mapAnnouncement),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  },

  async update(id: string, input: UpdateAnnouncementInput): Promise<AnnouncementResult> {
    const raw = await prisma.announcement.update({
      where:   { id },
      data:    input,
      include: announcementInclude,
    });
    return mapAnnouncement(raw);
  },

  async delete(id: string): Promise<void> {
    await prisma.announcement.delete({ where: { id } });
  },

  async isWorkspaceMember(workspaceId: string, userId: string) {
    return prisma.workspaceMember.findFirst({
      where:  { workspaceId, userId },
      select: { role: true },
    });
  },

  async isProjectMember(projectId: string, userId: string) {
    return prisma.projectMember.findFirst({
      where:  { projectId, userId },
      select: { role: true },
    });
  },
};