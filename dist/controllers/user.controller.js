import { prisma } from '../index.js';
import { StorageService } from '../services/storage.service.js';
// GET /api/user/profile
export const getUserProfile = async (req, res) => {
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
                        plan: true,
                        maxStorage: true,
                    },
                },
                workspaceMembers: {
                    select: {
                        workspace: {
                            select: {
                                id: true,
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
        // Get storage info using StorageService
        const storageInfo = await StorageService.getStorageInfo(user.id);
        res.status(200).json({
            success: true,
            data: {
                user,
                storage: {
                    total: storageInfo.totalMB,
                    used: storageInfo.usedMB,
                    remaining: storageInfo.remainingMB,
                    percentage: storageInfo.percentage,
                },
            },
        });
    }
    catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
        });
    }
};
// Helper function to check profile picture update limit based on plan
const canUpdateProfilePicture = (lastUpdated, userPlan) => {
    const now = new Date();
    const timeDiff = now.getTime() - lastUpdated.getTime();
    // Determine cooldown period based on plan
    let cooldownMs;
    let planName;
    switch (userPlan) {
        case 'FREE':
            cooldownMs = 24 * 60 * 60 * 1000; // 24 hours (1 day)
            planName = 'FREE';
            break;
        case 'PRO':
            cooldownMs = 6 * 60 * 60 * 1000; // 6 hours
            planName = 'PRO';
            break;
        case 'BUSINESS':
            cooldownMs = 30 * 60 * 1000; // 30 minutes
            planName = 'BUSINESS';
            break;
        case 'ENTERPRISE':
            // No restrictions for ENTERPRISE
            return { allowed: true };
        default:
            // Default to FREE plan restrictions
            cooldownMs = 24 * 60 * 60 * 1000;
            planName = 'FREE';
    }
    if (timeDiff >= cooldownMs) {
        return { allowed: true };
    }
    const timeRemainingMs = cooldownMs - timeDiff;
    const timeRemainingSec = Math.ceil(timeRemainingMs / 1000);
    // Calculate hours and minutes for user-friendly message
    const hours = Math.floor(timeRemainingSec / 3600);
    const minutes = Math.floor((timeRemainingSec % 3600) / 60);
    const seconds = timeRemainingSec % 60;
    // Build user-friendly message
    let message;
    if (planName === 'FREE') {
        message = hours > 0
            ? `You can only update your profile picture once per day (FREE plan). Please try again in ${hours}h ${minutes}m.`
            : `You can only update your profile picture once per day (FREE plan). Please try again in ${minutes}m ${seconds}s.`;
    }
    else if (planName === 'PRO') {
        message = hours > 0
            ? `You can update your profile picture once every 6 hours (PRO plan). Please try again in ${hours}h ${minutes}m.`
            : `You can update your profile picture once every 6 hours (PRO plan). Please try again in ${minutes}m ${seconds}s.`;
    }
    else if (planName === 'BUSINESS') {
        message = `You can update your profile picture once every 30 minutes (BUSINESS plan). Please try again in ${minutes}m ${seconds}s.`;
    }
    else {
        message = `Please try again in ${minutes}m ${seconds}s.`;
    }
    return {
        allowed: false,
        timeRemaining: timeRemainingSec,
        message
    };
};
// PUT /api/user/profile
export const updateUserProfile = async (req, res) => {
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
        // If updating profile picture, check rate limits
        if (image !== undefined) {
            const currentUser = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    updatedAt: true,
                    image: true,
                    ownedWorkspaces: {
                        select: {
                            plan: true,
                        },
                        take: 1,
                        orderBy: {
                            createdAt: 'desc', // Get the most recent workspace
                        },
                    },
                },
            });
            if (!currentUser) {
                res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
                return;
            }
            console.log(currentUser);
        }
        // Build update data object
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (bio !== undefined)
            updateData.bio = bio;
        if (image !== undefined)
            updateData.image = image;
        if (timezone !== undefined)
            updateData.timezone = timezone;
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
    }
    catch (error) {
        console.error('❌ Profile update error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
        });
    }
};
//# sourceMappingURL=user.controller.js.map