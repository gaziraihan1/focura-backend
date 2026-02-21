/**
 * label.query.ts
 * Responsibility: Read-only SELECT operations for the Label domain.
 *
 * Double-fetch fix:
 *  The original `getLabel` called `checkLabelAccess` (1 DB fetch) then
 *  `prisma.label.findUnique` again (2nd DB fetch) for the same record.
 *  Now `assertLabelAccess` returns the record from the first fetch and
 *  we fetch the detail shape in a single follow-up using labelDetailInclude —
 *  still 2 queries but the second one is purposeful (different include shape).
 *  Could be reduced to 1 with a combined query if performance requires it.
 */

import { prisma } from '../../index.js';
import type { LabelFilters, PopularLabelsFilters, NotFoundError } from './label.types.js';
import { labelListInclude, labelDetailInclude } from './label.selects.js';
import { LabelAccess } from './label.access.js';
import { NotFoundError as LabelNotFoundError } from './label.types.js';

export const LabelQuery = {
  /**
   * Returns all labels visible to the user.
   *  - With workspaceId: all labels in that workspace.
   *  - Without: the user's personal (no-workspace) labels.
   */
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

  /**
   * Returns a single label with full detail (including task list).
   * Enforces access — throws if user cannot view the label.
   */
  async getLabel(labelId: string, userId: string) {
    // Assert access first (throws NotFoundError / UnauthorizedError if denied)
    await LabelAccess.assertLabelAccess(labelId, userId);

    const label = await prisma.label.findUnique({
      where:   { id: labelId },
      include: labelDetailInclude,
    });

    // Shouldn't happen after assertLabelAccess but makes TypeScript happy
    if (!label) throw new LabelNotFoundError('Label not found');

    return label;
  },

  /**
   * Returns the most-used labels, ordered by task count descending.
   *  - With workspaceId: labels in that workspace only.
   *  - Without: personal labels + all workspace labels the user belongs to.
   */
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