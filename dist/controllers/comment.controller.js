import { prisma } from '../index.js';
// GET /api/tasks/:taskId/comments - Get all comments for a task
export const getComments = async (req, res) => {
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
    }
    catch (error) {
        console.error('Get comments error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch comments' });
    }
};
// POST /api/tasks/:taskId/comments - Add a new comment
export const addComment = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { content, parentId } = req.body;
        if (!taskId) {
            return res.status(400).json({ success: false, message: 'Task ID is required' });
        }
        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: 'Comment content is required' });
        }
        const comment = await prisma.comment.create({
            data: {
                content,
                taskId,
                userId: req.user.id,
                parentId: parentId || null,
            },
            include: {
                user: { select: { id: true, name: true, image: true } },
            },
        });
        res.status(201).json({ success: true, data: comment });
    }
    catch (error) {
        console.error('Add comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to add comment' });
    }
};
// DELETE /api/tasks/:taskId/comments/:commentId - Delete a comment
export const deleteComment = async (req, res) => {
    try {
        const { taskId, commentId } = req.params;
        const comment = await prisma.comment.findFirst({
            where: { id: commentId, taskId },
        });
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found' });
        }
        // Only allow the author to delete
        if (comment.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'You cannot delete this comment' });
        }
        await prisma.comment.delete({ where: { id: commentId } });
        res.json({ success: true, message: 'Comment deleted successfully' });
    }
    catch (error) {
        console.error('Delete comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete comment' });
    }
};
export const updateComment = async (req, res) => {
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
        if (comment.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'You cannot edit this comment' });
        }
        const updated = await prisma.comment.update({
            where: { id: commentId },
            data: { content, edited: true },
            include: { user: { select: { id: true, name: true, image: true } } },
        });
        res.json({ success: true, data: updated });
    }
    catch (error) {
        console.error('Update comment error:', error);
        res.status(500).json({ success: false, message: 'Failed to update comment' });
    }
};
//# sourceMappingURL=comment.controller.js.map