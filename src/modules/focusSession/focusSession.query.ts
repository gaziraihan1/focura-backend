
import { prisma } from '../../index.js';
import type { GetFocusHistoryInput } from './focusSession.types.js';
import { sessionWithSlimTask, sessionWithIdTitle } from './focusSession.selects.js';

export const FocusSessionQuery = {
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