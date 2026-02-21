/**
 * focusSession.query.ts
 * Responsibility: Read-only SELECT operations for the FocusSession domain.
 *
 * Rules:
 *  - No writes, no side effects.
 *  - getActiveSession is here (not in mutation) because it is a pure read —
 *    the mutation file calls it as a dependency, not the other way around.
 */

import { prisma } from '../../index.js';
import type { GetFocusHistoryInput } from './focusSession.types.js';
import { sessionWithSlimTask, sessionWithIdTitle } from './focusSession.selects.js';

export const FocusSessionQuery = {
  /**
   * Returns the user's current active (incomplete) session, or null.
   */
  async getActiveSession(userId: string) {
    return prisma.focusSession.findFirst({
      where: {
        userId,
        completed: false,
        endedAt:   null,
      },
      include: sessionWithSlimTask,
      orderBy: { startedAt: 'desc' },
    });
  },

  /**
   * Returns the user's completed session history, newest first.
   */
  async getHistory(input: GetFocusHistoryInput) {
    return prisma.focusSession.findMany({
      where: {
        userId:    input.userId,
        completed: true,
      },
      include: sessionWithIdTitle,
      orderBy: { startedAt: 'desc' },
      take:    input.limit ?? 30,
    });
  },
};