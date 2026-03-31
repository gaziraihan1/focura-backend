import { prisma } from '../../index.js';
import type {
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
  AnnouncementFilterParams,
  PaginatedAnnouncementsResult,
  AnnouncementResult,
} from './announcement.types.js';

// ─── Select shapes ────────────────────────────────────────────────────────────

const announcementInclude = {
  createdBy: {
    select: { id: true, name: true, image: true },
  },
  targets: {
    include: {
      user: { select: { id: true, name: true, image: true } },
    },
  },
} as const;

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapAnnouncement(raw: any): AnnouncementResult {
  return {
    ...raw,
    createdBy: {
      ...raw.createdBy,
      name: raw.createdBy.name ?? 'Unknown',
    },
    targets: raw.targets.map((t: any) => ({
      userId: t.userId,
      user: {
        ...t.user,
        name: t.user.name ?? 'Unknown',
      },
    })),
  };
}
// ─── Repository ───────────────────────────────────────────────────────────────

export const AnnouncementRepository = {
  async create(input: CreateAnnouncementInput) {
    const raw = await prisma.announcement.create({
      data: {
        title:       input.title,
        content:     input.content,
        visibility:  input.visibility,
        isPinned:    input.isPinned ?? false,
        workspaceId: input.workspaceId,
        createdById: input.createdById,
        ...(input.visibility === 'PRIVATE' &&
          input.targetIds &&
          input.targetIds.length > 0 && {
            targets: {
              create: input.targetIds.map((userId) => ({ userId })),
            },
          }),
      },
      include: announcementInclude,
    });
    return mapAnnouncement(raw)
  },

  async findById(id: string) {
    const raw = await prisma.announcement.findUnique({
      where:   { id },
      include: announcementInclude,
    });
    return raw ? mapAnnouncement(raw) : null
  },

  async findMany(
    params: AnnouncementFilterParams,
  ): Promise<PaginatedAnnouncementsResult> {
    const page     = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 10));
    const skip     = (page - 1) * pageSize;

    // Access filter: public OR (private + user is a target OR creator)
    const accessFilter =
      params.visibility === 'PRIVATE'
        ? {
            visibility: 'PRIVATE' as const,
            OR: [
              { createdById: params.userId },
              { targets: { some: { userId: params.userId } } },
            ],
          }
        : params.visibility === 'PUBLIC'
        ? { visibility: 'PUBLIC' as const }
        : {
            OR: [
              { visibility: 'PUBLIC' as const },
              {
                visibility: 'PRIVATE' as const,
                OR: [
                  { createdById: params.userId },
                  { targets: { some: { userId: params.userId } } },
                ],
              },
            ],
          };

    const where = {
      workspaceId: params.workspaceId,
      ...(params.isPinned !== undefined && { isPinned: params.isPinned }),
      ...accessFilter,
    };

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

return {
  data: rows.map(mapAnnouncement),   // ← was: data
  pagination: {
    page,
    pageSize,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    hasNext:    page < Math.ceil(totalCount / pageSize),
    hasPrev:    page > 1,
  },
};
  },

  async update(id: string, input: UpdateAnnouncementInput) {
    return prisma.announcement.update({
      where:   { id },
      data:    input,
      include: announcementInclude,
    });
  },

  async delete(id: string) {
    // AnnouncementTarget cascades via schema relation
    return prisma.announcement.delete({ where: { id } });
  },

  async isWorkspaceMember(workspaceId: string, userId: string) {
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { role: true },
    });
    return member;
  },
};