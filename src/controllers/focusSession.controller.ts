// controllers/focus-session.controller.ts

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { z } from 'zod';
import { FocusSessionService } from '../services/focusSession.service.js';

const startSessionSchema = z.object({
  taskId: z.string().optional(),
  type: z.enum(['POMODORO', 'SHORT_BREAK', 'LONG_BREAK', 'DEEP_WORK', 'CUSTOM']),
  duration: z.number().min(1).max(480), // 1-480 minutes
});

const getHistorySchema = z.object({
  limit: z.string().optional().default('30'),
});

export class FocusSessionController {
  /**
   * POST /api/focus-sessions/start
   * Start a new focus session
   */
  static async startSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { taskId, type, duration } = startSessionSchema.parse(req.body);

      const session = await FocusSessionService.startSession({
        userId,
        taskId,
        type,
        duration,
      });

      return res.status(201).json({
        success: true,
        data: session,
        message: 'Focus session started',
      });
    } catch (error) {
      console.error('Start focus session error:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues,
        });
      }

      if ((error as Error).message === 'USER_HAS_ACTIVE_SESSION') {
        const activeSession = await FocusSessionService.getActiveSession(req.user!.id);
        return res.status(400).json({
          success: false,
          message: 'You already have an active focus session',
          data: activeSession,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to start focus session',
      });
    }
  }

  /**
   * POST /api/focus-sessions/:id/complete
   * Complete an existing focus session
   */
  static async completeSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const session = await FocusSessionService.completeSession({
        sessionId: id,
        userId,
      });

      return res.json({
        success: true,
        data: session,
        message: 'Focus session completed',
      });
    } catch (error) {
      console.error('Complete focus session error:', error);

      if ((error as Error).message === 'SESSION_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: 'Focus session not found',
        });
      }

      if ((error as Error).message === 'SESSION_ALREADY_COMPLETED') {
        return res.status(400).json({
          success: false,
          message: 'Session already completed',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to complete focus session',
      });
    }
  }

  /**
   * POST /api/focus-sessions/:id/cancel
   * Cancel an active focus session
   */
  static async cancelSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await FocusSessionService.cancelSession({
        sessionId: id,
        userId,
      });

      return res.json({
        success: true,
        message: 'Focus session cancelled',
      });
    } catch (error) {
      console.error('Cancel focus session error:', error);

      if ((error as Error).message === 'SESSION_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: 'Focus session not found',
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to cancel focus session',
      });
    }
  }

  /**
   * GET /api/focus-sessions/active
   * Get user's current active session
   */
  static async getActiveSession(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;

      const session = await FocusSessionService.getActiveSession(userId);

      return res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      console.error('Get active session error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get active session',
      });
    }
  }

  /**
   * GET /api/focus-sessions/history
   * Get user's focus session history
   */
  static async getHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { limit } = getHistorySchema.parse(req.query);

      const sessions = await FocusSessionService.getHistory({
        userId,
        limit: parseInt(limit),
      });

      return res.json({
        success: true,
        data: sessions,
      });
    } catch (error) {
      console.error('Get focus history error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get focus history',
      });
    }
  }

  /**
   * GET /api/focus-sessions/stats
   * Get user's focus session statistics
   */
  static async getStats(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { startDate, endDate } = req.query;

      const stats = await FocusSessionService.getStats(
        userId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      const streak = await FocusSessionService.getFocusStreak(userId);

      return res.json({
        success: true,
        data: {
          ...stats,
          focusStreak: streak,
        },
      });
    } catch (error) {
      console.error('Get focus stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get focus statistics',
      });
    }
  }
}