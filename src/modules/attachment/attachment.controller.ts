import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import { AttachmentQuery } from "./attachment.query.js";
import { AttachmentMutation } from "./attachment.mutation.js";
import {
  getStorageInfo,
  seedWorkspaceStorageFromDb,
} from "./attatchment.quota.service.js";
import { prisma } from "../../index.js";
import { WorkspacePlan } from "./attachment.quota.types.js";

function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof Error) {
    const msg  = error.message;
    const code = (error as any).code as string | undefined;

    // Storage / rate-limit errors
    if (
      code === "STORAGE_FULL"      ||
      code === "FILE_TOO_LARGE"    ||
      code === "DAILY_LIMIT"       ||
      code === "RATE_LIMIT_MINUTE" ||
      code === "RATE_LIMIT_HOUR"   ||
      msg.includes("limit")        ||
      msg.includes("wait")         ||
      msg.includes("full")
    ) {
      const retryAfterMs = (error as any).retryAfterMs as number | undefined;
      res
        .status(429)
        .set(retryAfterMs ? { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } : {})
        .json({ success: false, message: msg, code });
      return;
    }

    if (msg.includes("permission") || msg.includes("cannot")) {
      res.status(403).json({ success: false, message: msg });
      return;
    }

    if (msg.includes("not found")) {
      res.status(404).json({ success: false, message: msg });
      return;
    }

    console.error(`${label} error:`, error);
    res.status(500).json({ success: false, message: `Failed to ${label}` });
  } else {
    console.error(`${label} error:`, error);
    res.status(500).json({ success: false, message: `Failed to ${label}` });
  }
}

export const getTaskAttachments = async (req: AuthRequest, res: Response) => {
  try {
    const attachments = await AttachmentQuery.getTaskAttachments(
      req.params.taskId,
      req.user!.id,
    );
    res.json({ success: true, data: attachments });
  } catch (error) {
    handleError(res, "fetch attachments", error);
  }
};

export const addAttachment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: "No file provided" });
      return;
    }

    const file = await AttachmentMutation.addAttachment({
      taskId: req.params.taskId,
      userId: req.user!.id,
      file:   req.file,
    });

    res.status(201).json({ success: true, data: file, message: "File uploaded successfully" });
  } catch (error) {
    handleError(res, "upload attachment", error);
  }
};

export const deleteAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const { attachmentId } = req.params;
    if (!attachmentId) {
      res.status(400).json({ success: false, message: "File ID is required" });
      return;
    }

    await AttachmentMutation.deleteAttachment(attachmentId, req.user!.id);
    res.json({ success: true, message: "Attachment deleted successfully" });
  } catch (error) {
    handleError(res, "delete attachment", error);
  }
};

export const getAttachmentStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await AttachmentQuery.getWorkspaceAttachmentStats(
      req.params.workspaceId,
      req.user!.id,
    );
    res.json({ success: true, data: stats });
  } catch (error) {
    handleError(res, "fetch attachment statistics", error);
  }
};

/**
 * GET /workspaces/:workspaceId/storage
 * Returns storage usage for any workspace member.
 * Admins also see per-user breakdown via getAttachmentStats.
 */
export const getWorkspaceStorage = async (req: AuthRequest, res: Response) => {
  try {
    const { workspaceId } = req.params;

    // Verify membership
    const member = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: req.user!.id },
    });
    if (!member) {
      res.status(403).json({ success: false, message: "Not a workspace member" });
      return;
    }

    const ws = await prisma.workspace.findUnique({
      where:  { id: workspaceId },
      select: { plan: true } as any,
    });
    const plan = ((ws as any)?.plan ?? "FREE") as WorkspacePlan;

    // Seed on cache miss
    const agg = await prisma.file.aggregate({
      where: { workspaceId },
      _sum:  { size: true },
    });
    await seedWorkspaceStorageFromDb(workspaceId, agg._sum.size ?? 0);

    const storage = await getStorageInfo(workspaceId, plan);
    res.json({ success: true, data: storage });
  } catch (error) {
    handleError(res, "fetch workspace storage", error);
  }
};