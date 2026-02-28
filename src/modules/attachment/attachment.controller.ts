
import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { AttachmentQuery } from './attachment.query.js';
import { AttachmentMutation } from './attachment.mutation.js';

function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof Error) {
    const msg = error.message;

    if (msg.includes('limit') || msg.includes('wait')) {
      res.status(429).json({ success: false, message: msg });
      return;
    }

    if (msg.includes('permission') || msg.includes('cannot')) {
      res.status(403).json({ success: false, message: msg });
      return;
    }

    if (msg.includes('not found')) {
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
      req.params.taskId,  // ← Changed from req.params.taskId
      req.user!.id,
    );
    res.json({ success: true, data: attachments });
  } catch (error) {
    handleError(res, 'fetch attachments', error);
  }
};

export const addAttachment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file provided' });
      return;
    }

    const file = await AttachmentMutation.addAttachment({
      taskId: req.params.taskId,  // ← Changed from req.params.taskId
      userId: req.user!.id,
      file: req.file,
    });

    res.status(201).json({
      success: true,
      data: file,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    handleError(res, 'upload attachment', error);
  }
};

export const deleteAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const fileId = req.params.attachmentId;

    if (!fileId) {
      res.status(400).json({ success: false, message: 'File ID is required' });
      return;
    }

    await AttachmentMutation.deleteAttachment(fileId, req.user!.id);
    res.json({ success: true, message: 'Attachment deleted successfully' });
  } catch (error) {
    handleError(res, 'delete attachment', error);
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
    handleError(res, 'fetch attachment statistics', error);
  }
};