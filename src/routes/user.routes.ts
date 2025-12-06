// routes/user.routes.ts
import { Router, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getUserProfile, updateUserProfile } from '../controllers/user.controller.js';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../index.js';

const router = Router();

// GET /api/user/profile - Get user profile
router.get('/profile', authenticate, getUserProfile);

// PUT /api/user/profile - Update user profile
router.put('/profile', authenticate, updateUserProfile);

// GET /api/user/workspace-members - Get workspace members
router.get('/workspace-members', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    // Get all workspace members where user has access
    const members = await prisma.user.findMany({
      where: {
        workspaceMembers: {
          some: {
            workspace: {
              OR: [
                { ownerId: req.user!.id },
                { members: { some: { userId: req.user!.id } } },
              ],
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
      distinct: ['id'],
    });

    res.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error('Get workspace members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace members',
    });
  }
});


export default router;