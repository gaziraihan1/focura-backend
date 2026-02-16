// controllers/user.controller.ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { prisma } from '../index.js';

// GET /api/user/profile
export const getUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        timezone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        ownedWorkspaces: {
          select: {
            id: true,
            name: true,
            plan: true,
            maxStorage: true,
          },
        },
        workspaceMembers: {
          select: {
            workspace: {
              select: {
                id: true,
                name: true,
                plan: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    // Note: Storage is now workspace-specific
    // Users should check /api/storage/workspaces for storage info
    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
    });
  }
};

// PUT /api/user/profile
export const updateUserProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const { name, bio, image, timezone } = req.body;

    // Validate input
    if (name !== undefined && typeof name !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Invalid name format',
      });
      return;
    }

    if (bio !== undefined && typeof bio !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Invalid bio format',
      });
      return;
    }

    if (timezone !== undefined && typeof timezone !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Invalid timezone format',
      });
      return;
    }

    // Build update data object
    const updateData: Record<string, string | null> = {};
    if (name !== undefined) updateData.name = name;
    if (bio !== undefined) updateData.bio = bio;
    if (image !== undefined) updateData.image = image;
    if (timezone !== undefined) updateData.timezone = timezone;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        bio: true,
        timezone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log('✅ Profile updated successfully for user:', req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user: updatedUser,
      },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
};