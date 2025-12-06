import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../index.js';

const router = Router();

// GET /api/labels
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const labels = await prisma.label.findMany({
      where: {
        workspace: {
          OR: [
            { ownerId: req.user!.id },
            { members: { some: { userId: req.user!.id } } },
          ],
        },
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: labels,
    });
  } catch (error) {
    console.error('Get labels error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch labels',
    });
  }
});

export default router;