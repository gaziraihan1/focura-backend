import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../index.js';
import { ActivityService } from '../services/activity.service.js'; // NEW

// GET /api/tasks/:taskId/comments - Get all comments for a task
export const getComments = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
        replies: {
          include: { user: { select: { id: true, name: true, image: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: comments });
  } catch (error: any) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch comments' });
  }
};

// POST /api/tasks/:taskId/comments - Add a new comment
export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const { content, parentId } = req.body;

    if (!taskId) {
      return res.status(400).json({ success: false, message: 'Task ID is required' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    // NEW: Get task with workspace info for activity logging
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        project: {
          select: { workspaceId: true },
        },
      },
    });

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId,
        userId: req.user!.id,
        parentId: parentId || null,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    // NEW: Log activity
    if (task?.project?.workspaceId) {
      try {
        await ActivityService.createActivity({
          action: 'COMMENTED',
          entityType: 'COMMENT',
          entityId: comment.id,
          userId: req.user!.id,
          workspaceId: task.project.workspaceId,
          taskId: taskId,
          metadata: {
            taskTitle: task.title,
            commentPreview: content.substring(0, 100),
          },
        });
      } catch (activityError) {
        console.error('Failed to log comment activity:', activityError);
        // Don't fail the request if activity logging fails
      }
    }

    res.status(201).json({ success: true, data: comment });
  } catch (error: any) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Failed to add comment' });
  }
};

// DELETE /api/tasks/:taskId/comments/:commentId - Delete a comment
export const deleteComment = async (req: AuthRequest, res: Response) => {
  try {
    const { taskId, commentId } = req.params;

    const comment = await prisma.comment.findFirst({
      where: { id: commentId, taskId },
    });

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    // Only allow the author to delete
    if (comment.userId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'You cannot delete this comment' });
    }

    // NEW: Get task with workspace info BEFORE deleting
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        title: true,
        project: {
          select: { workspaceId: true },
        },
      },
    });

    await prisma.comment.delete({ where: { id: commentId } });

    // NEW: Log activity
    if (task?.project?.workspaceId) {
      try {
        await ActivityService.createActivity({
          action: 'DELETED',
          entityType: 'COMMENT',
          entityId: commentId,
          userId: req.user!.id,
          workspaceId: task.project.workspaceId,
          taskId: taskId,
          metadata: {
            taskTitle: task.title,
            commentContent: comment.content.substring(0, 100),
          },
        });
      } catch (activityError) {
        console.error('Failed to log comment deletion:', activityError);
      }
    }

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error: any) {
    console.error('Delete comment error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete comment' });
  }
};

export const updateComment = async (req: AuthRequest, res: Response) => {
  try {
    const { commentId, taskId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const comment = await prisma.comment.findFirst({
      where: { id: commentId, taskId },
    });

    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (comment.userId !== req.user!.id) {
      return res.status(403).json({ success: false, message: 'You cannot edit this comment' });
    }

    // NEW: Get task with workspace info
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        title: true,
        project: {
          select: { workspaceId: true },
        },
      },
    });

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { content, edited: true },
      include: { user: { select: { id: true, name: true, image: true } } },
    });

    // NEW: Log activity
    if (task?.project?.workspaceId) {
      try {
        await ActivityService.createActivity({
          action: 'UPDATED',
          entityType: 'COMMENT',
          entityId: commentId,
          userId: req.user!.id,
          workspaceId: task.project.workspaceId,
          taskId: taskId,
          metadata: {
            taskTitle: task.title,
            oldContent: comment.content.substring(0, 50),
            newContent: content.substring(0, 50),
          },
        });
      } catch (activityError) {
        console.error('Failed to log comment update:', activityError);
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ success: false, message: 'Failed to update comment' });
  }
};