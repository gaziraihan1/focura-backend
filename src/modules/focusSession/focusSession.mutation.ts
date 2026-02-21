/**
 * focusSession.mutation.ts
 * Responsibility: Write operations for the FocusSession domain.
 *
 * Calendar decoupling:
 *  The original called CalendarService.recalculateAggregate() directly
 *  inside completeSession — this module imported from the calendar module,
 *  creating a cross-module dependency that breaks the rule:
 *  "modules never import from each other directly."
 *
 *  Solution: onComplete accepts an optional async callback.
 *  The controller (or a future event bus) provides the callback.
 *  FocusSession knows nothing about Calendar.
 *
 * Error codes:
 *  Throws FocusSessionError constants (typed strings), not raw messages.
 *  The controller maps these to HTTP status codes without string matching.
 */

import { prisma } from '../../index.js';
import type {
  CreateFocusSessionInput,
  CompleteFocusSessionInput,
  CancelFocusSessionInput,
} from './focusSession.types.js';
import { FocusSessionError } from './focusSession.types.js';
import { FocusSessionQuery } from './focusSession.query.js';
import { sessionWithIdTitle } from './focusSession.selects.js';

export const FocusSessionMutation = {
  /**
   * Starts a new focus session.
   * Throws USER_HAS_ACTIVE_SESSION if one already exists.
   */
  async startSession(input: CreateFocusSessionInput) {
    const active = await FocusSessionQuery.getActiveSession(input.userId);

    if (active) {
      throw new Error(FocusSessionError.USER_HAS_ACTIVE_SESSION);
    }

    return prisma.focusSession.create({
      data: {
        userId:    input.userId,
        taskId:    input.taskId,
        type:      input.type,
        duration:  input.duration,
        startedAt: new Date(),
      },
      include: sessionWithIdTitle,
    });
  },

  /**
   * Marks a session as completed.
   *
   * @param onComplete Optional async callback fired after the DB write.
   *   Used by the controller to trigger calendar recalculation without
   *   this module importing from the calendar module.
   *   Always fire-and-forget — errors in the callback never surface to the caller.
   */
  async completeSession(
    input: CompleteFocusSessionInput,
    onComplete?: (session: { startedAt: Date; workspaceId?: string }) => Promise<void>,
  ) {
    const session = await prisma.focusSession.findFirst({
      where: { id: input.sessionId, userId: input.userId },
      include: { task: true },
    });

    if (!session) {
      throw new Error(FocusSessionError.SESSION_NOT_FOUND);
    }

    if (session.completed) {
      throw new Error(FocusSessionError.SESSION_ALREADY_COMPLETED);
    }

    const updated = await prisma.focusSession.update({
      where: { id: input.sessionId },
      data:  { completed: true, endedAt: new Date() },
      include: { task: true },
    });

    // Fire callback (calendar recalculation, event bus, etc.) — never throws
    if (onComplete) {
      onComplete({
        startedAt:   session.startedAt,
        workspaceId: session.task?.workspaceId ?? undefined,
      }).catch((err) => {
        console.error('Post-completion callback failed:', err);
      });
    }

    return updated;
  },

  /**
   * Cancels (deletes) an active session.
   * Throws SESSION_NOT_FOUND if the session doesn't exist or doesn't belong to the user.
   */
  async cancelSession(input: CancelFocusSessionInput) {
    const session = await prisma.focusSession.findFirst({
      where: { id: input.sessionId, userId: input.userId },
    });

    if (!session) {
      throw new Error(FocusSessionError.SESSION_NOT_FOUND);
    }

    await prisma.focusSession.delete({ where: { id: input.sessionId } });

    return session;
  },
};