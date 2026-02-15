import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { CalendarService } from '../services/calendar.service.js';
import { z } from 'zod';

const getCalendarDataSchema = z.object({
  workspaceId: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

const createGoalCheckpointSchema = z.object({
  workspaceId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'KPI']),
  targetDate: z.coerce.date(),
});

export class CalendarController {
  static async getCalendarAggregates(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { workspaceId, startDate, endDate } = getCalendarDataSchema.parse(req.query);

      const aggregates = await CalendarService.getCalendarAggregates({
        userId,
        workspaceId,
        startDate,
        endDate,
      });

      return res.json({
        success: true,
        data: aggregates,
      });
    } catch (error) {
      console.error('Get calendar aggregates error:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch calendar aggregates',
      });
    }
  }

  static async getCalendarInsights(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { workspaceId, startDate, endDate } = getCalendarDataSchema.parse(req.query);

      const insights = await CalendarService.getCalendarInsights(
        userId,
        workspaceId,
        startDate,
        endDate
      );

      return res.json({
        success: true,
        data: insights,
      });
    } catch (error) {
      console.error('Get calendar insights error:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch calendar insights',
      });
    }
  }

  static async getSystemEvents(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { workspaceId, startDate, endDate } = getCalendarDataSchema.parse(req.query);

      const events = await CalendarService.getSystemEvents(
        userId,
        workspaceId,
        startDate,
        endDate
      );

      return res.json({
        success: true,
        data: events,
      });
    } catch (error) {
      console.error('Get system events error:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch system events',
      });
    }
  }

  static async getGoalCheckpoints(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { workspaceId, startDate, endDate } = getCalendarDataSchema.parse(req.query);

      const goals = await CalendarService.getGoalCheckpoints(
        userId,
        workspaceId,
        startDate,
        endDate
      );

      return res.json({
        success: true,
        data: goals,
      });
    } catch (error) {
      console.error('Get goal checkpoints error:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch goal checkpoints',
      });
    }
  }

  static async createGoalCheckpoint(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const validatedData = createGoalCheckpointSchema.parse(req.body);

      const goal = await CalendarService.createGoalCheckpoint({
        userId,
        ...validatedData,
      });

      return res.status(201).json({
        success: true,
        data: goal,
        message: 'Goal checkpoint created successfully',
      });
    } catch (error) {
      console.error('Create goal checkpoint error:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to create goal checkpoint',
      });
    }
  }

  static async recalculateAggregate(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;
      const { workspaceId, date } = z.object({
        workspaceId: z.string().optional(),
        date: z.coerce.date(),
      }).parse(req.body);

      await CalendarService.recalculateAggregate(userId, workspaceId, date);

      return res.json({
        success: true,
        message: 'Aggregate recalculated successfully',
      });
    } catch (error) {
      console.error('Recalculate aggregate error:', error);

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to recalculate aggregate',
      });
    }
  }

  static async initializeUserSettings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user!.id;

      await CalendarService.initializeUserSettings(userId);

      return res.json({
        success: true,
        message: 'User calendar settings initialized successfully',
      });
    } catch (error) {
      console.error('Initialize user settings error:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to initialize user settings',
      });
    }
  }
}