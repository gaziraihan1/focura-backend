import { prisma } from '../../lib/prisma.js';
import type { LabelFilters, PopularLabelsFilters, NotFoundError } from './label.types.js';
import { labelListInclude, labelDetailInclude } from './label.selects.js';
import { LabelAccess } from './label.access.js';
import { NotFoundError as LabelNotFoundError } from './label.types.js';

export const LabelQuery = {
  async getLabels(userId: string, filters: LabelFilters = {}) {
    const where = filters.workspaceId
      ? { workspaceId: filters.workspaceId }
      : { createdById: userId, workspaceId: null };

    return prisma.label.findMany({
      where,
      include: labelListInclude,
      orderBy: { name: 'asc' },
    });
  },

  async getLabel(labelId: string, userId: string) {
    await LabelAccess.assertLabelAccess(labelId, userId);

    const label = await prisma.label.findUnique({
      where:   { id: labelId },
      include: labelDetailInclude,
    });

    if (!label) throw new LabelNotFoundError('Label not found');

    return label;
  },

  async getPopularLabels(userId: string, filters: PopularLabelsFilters = {}) {
    const where = filters.workspaceId
      ? { workspaceId: filters.workspaceId }
      : {
          OR: [
            { createdById: userId, workspaceId: null as null },
            {
              workspace: {
                OR: [
                  { ownerId: userId },
                  { members: { some: { userId } } },
                ],
              },
            },
          ],
        };

    return prisma.label.findMany({
      where,
      include: labelListInclude,
      orderBy: { tasks: { _count: 'desc' } },
      take:    filters.limit ?? 10,
    });
  },
};