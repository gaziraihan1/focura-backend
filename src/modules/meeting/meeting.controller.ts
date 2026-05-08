import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { MeetingService } from "./meeting.service.js";
import {
  createMeetingSchema,
  updateMeetingSchema,
  listMeetingsSchema,
} from "./meeting.validator.js";
import { prisma } from "../../lib/prisma.js";

export class MeetingController {
  private static handleMeetingError(error: any, res: Response) {
  console.error('[Meeting500] message:', error?.message);
  console.error('[Meeting500] stack:', error?.stack);
  console.error('[Meeting500] full:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

  if (error.message?.includes('FORBIDDEN')) {
    return res.status(403).json({ success: false, message: error.message });
  }
  if (error.message?.includes('NOT_FOUND')) {
    return res.status(404).json({ success: false, message: error.message });
  }
  if (error.message?.includes('BAD_REQUEST')) {
    return res.status(400).json({ success: false, message: error.message });
  }

  return res.status(500).json({ success: false, message: 'Failed to process meeting request' });
}

 private static async resolveCtx(req: AuthRequest, workspaceId: string) {
  const member = await prisma.workspaceMember.findFirst({
    where: {
      userId: req.user?.id!,
      workspaceId,
    },
    select: { role: true },
  });

  return {
    userId: req.user?.id!,
    workspaceId,
    workspaceRole: member?.role ?? null,
  };
}

  static async list(req: AuthRequest, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const parsed = listMeetingsSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.flatten() });
    }

    const ctx = await MeetingController.resolveCtx(req, req.params.workspaceId);
    if (!ctx.workspaceRole) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this workspace",
      });
    }

    const result = await MeetingService.list(ctx, parsed.data);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return MeetingController.handleMeetingError(error, res);
  }
}

  static async getById(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const ctx = await MeetingController.resolveCtx(
        req,
        req.params.workspaceId,
      );
      if (!ctx.workspaceRole) {
        return res.status(403).json({
          success: false,
          message: "You are not a member of this workspace",
        });
      }

      const meeting = await MeetingService.getById(ctx, req.params.meetingId);
      return res.json({ success: true, data: meeting });
    } catch (error: any) {
      return MeetingController.handleMeetingError(error, res);
    }
  }

  static async create(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const parsed = createMeetingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: parsed.error.flatten() });
      }

      const ctx = await MeetingController.resolveCtx(
        req,
        req.params.workspaceId,
      );
      if (!ctx.workspaceRole) {
        return res.status(403).json({
          success: false,
          message: "You are not a member of this workspace",
        });
      }

      const senderName = req.user.name ?? "Someone";
      const meeting = await MeetingService.create(ctx, parsed.data, senderName);
      return res.status(201).json({ success: true, data: meeting });
    } catch (error: any) {
      return MeetingController.handleMeetingError(error, res);
    }
  }

  static async update(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const parsed = updateMeetingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ success: false, error: parsed.error.flatten() });
      }

      const ctx = await MeetingController.resolveCtx(
        req,
        req.params.workspaceId,
      );
      if (!ctx.workspaceRole) {
        return res.status(403).json({
          success: false,
          message: "You are not a member of this workspace",
        });
      }

      const senderName = req.user.name ?? "Someone";
      const meeting = await MeetingService.update(
        ctx,
        req.params.meetingId,
        parsed.data,
        senderName,
      );
      return res.json({ success: true, data: meeting });
    } catch (error: any) {
      return MeetingController.handleMeetingError(error, res);
    }
  }

  static async cancel(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const ctx = await MeetingController.resolveCtx(
        req,
        req.params.workspaceId,
      );
      if (!ctx.workspaceRole) {
        return res.status(403).json({
          success: false,
          message: "You are not a member of this workspace",
        });
      }

      const senderName = req.user.name ?? "Someone";
      const meeting = await MeetingService.cancel(
        ctx,
        req.params.meetingId,
        senderName,
      );
      return res.json({ success: true, data: meeting });
    } catch (error: any) {
      return MeetingController.handleMeetingError(error, res);
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      if (!req.user?.id) {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const ctx = await MeetingController.resolveCtx(
        req,
        req.params.workspaceId,
      );
      if (!ctx.workspaceRole) {
        return res.status(403).json({
          success: false,
          message: "You are not a member of this workspace",
        });
      }

      await MeetingService.delete(ctx, req.params.meetingId);
      return res.json({ success: true });
    } catch (error: any) {
      return MeetingController.handleMeetingError(error, res);
    }
  }
}
