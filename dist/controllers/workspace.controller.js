// ============================================
// src/controllers/workspace.controller.ts
// ============================================
import { WorkspaceService } from '../services/workspace.service.js';
import { z } from 'zod';
// Validation schemas
const createWorkspaceSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    logo: z.string().url().optional(),
    isPublic: z.boolean().optional(),
    plan: z.enum(['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE']).optional(),
});
const updateWorkspaceSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    logo: z.string().url().optional(),
    isPublic: z.boolean().optional(),
    allowInvites: z.boolean().optional(),
});
const inviteMemberSchema = z.object({
    email: z.string().email(),
    role: z.enum(['MEMBER', 'ADMIN', 'GUEST']),
});
export class WorkspaceController {
    // GET /api/workspaces - Get all user workspaces
    static async getAllWorkspaces(req, res) {
        try {
            const userId = req.user.id;
            const workspaces = await WorkspaceService.getUserWorkspaces(userId);
            return res.json({
                success: true,
                data: workspaces,
            });
        }
        catch (error) {
            console.error('Get workspaces error:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch workspaces',
            });
        }
    }
    // POST /api/workspaces - Create new workspace
    static async createWorkspace(req, res) {
        try {
            const userId = req.user.id;
            const validatedData = createWorkspaceSchema.parse(req.body);
            const workspace = await WorkspaceService.create(userId, validatedData);
            return res.status(201).json({
                success: true,
                data: workspace,
                message: 'Workspace created successfully',
            });
        }
        catch (error) {
            console.error('Create workspace error:', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: error.errors,
                });
            }
            // Handle workspace limit errors
            if (error.message && error.message.includes('Workspace limit reached')) {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                    code: 'WORKSPACE_LIMIT_REACHED',
                });
            }
            // Handle user not found
            if (error.message === 'User not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message,
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to create workspace',
            });
        }
    }
    static async getWorkspace(req, res) {
        try {
            const { slug } = req.params;
            const userId = req.user.id;
            const workspace = await WorkspaceService.getBySlug(slug, userId);
            return res.json({
                success: true,
                data: workspace,
            });
        }
        catch (error) {
            console.error('Get workspace error:', error);
            if (error.message === 'Workspace not found' || error.message === 'Unauthorized') {
                return res.status(404).json({
                    success: false,
                    message: 'Workspace not found',
                });
            }
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch workspace',
            });
        }
    }
    static async updateWorkspace(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const validatedData = updateWorkspaceSchema.parse(req.body);
            const workspace = await WorkspaceService.update(id, userId, validatedData);
            return res.json({
                success: true,
                data: workspace,
                message: 'Workspace updated successfully',
            });
        }
        catch (error) {
            console.error('Update workspace error:', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: error.errors,
                });
            }
            if (error.message === 'Unauthorized') {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to update this workspace',
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to update workspace',
            });
        }
    }
    static async deleteWorkspace(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            await WorkspaceService.delete(id, userId);
            return res.json({
                success: true,
                message: 'Workspace deleted successfully',
            });
        }
        catch (error) {
            console.error('Delete workspace error:', error);
            if (error.message === 'Unauthorized') {
                return res.status(403).json({
                    success: false,
                    message: 'Only workspace owner can delete the workspace',
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to delete workspace',
            });
        }
    }
    static async getMembers(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const members = await WorkspaceService.getMembers(id, userId);
            return res.json({
                success: true,
                data: members,
            });
        }
        catch (error) {
            console.error('Get members error:', error);
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch members',
            });
        }
    }
    static async inviteMember(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const validatedData = inviteMemberSchema.parse(req.body);
            const invitation = await WorkspaceService.inviteMember(id, userId, validatedData.email, validatedData.role);
            return res.json({
                success: true,
                data: invitation,
                message: 'Invitation sent successfully',
            });
        }
        catch (error) {
            console.error('Invite member error:', error);
            if (error.name === 'ZodError') {
                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: error.errors,
                });
            }
            if (error.message === 'Unauthorized') {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to invite members',
                });
            }
            // Handle specific invite errors with 400 status
            if (error.message === 'User already invited' || error.message === 'User is already a member') {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to send invitation',
            });
        }
    }
    static async getInvitation(req, res) {
        try {
            const { token } = req.params;
            if (!token) {
                return res.status(400).json({
                    success: false,
                    message: 'Invitation token is required',
                });
            }
            const invitation = await WorkspaceService.getInvitationByToken(token);
            return res.json({
                success: true,
                data: invitation,
            });
        }
        catch (error) {
            console.error('Get invitation error:', error);
            if (error.message === 'Invitation not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message,
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch invitation',
            });
        }
    }
    static async removeMember(req, res) {
        try {
            const { id, memberId } = req.params;
            const userId = req.user.id;
            await WorkspaceService.removeMember(id, userId, memberId);
            return res.json({
                success: true,
                message: 'Member removed successfully',
            });
        }
        catch (error) {
            console.error('Remove member error:', error);
            if (error.message === 'Unauthorized') {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to remove members',
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to remove member',
            });
        }
    }
    // PUT /api/workspaces/:id/members/:memberId/role - Update member role
    static async updateMemberRole(req, res) {
        try {
            const { id, memberId } = req.params;
            const { role } = req.body;
            const userId = req.user.id;
            const member = await WorkspaceService.updateMemberRole(id, userId, memberId, role);
            return res.json({
                success: true,
                data: member,
                message: 'Member role updated successfully',
            });
        }
        catch (error) {
            console.error('Update member role error:', error);
            if (error.message === 'Unauthorized') {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to update member roles',
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to update member role',
            });
        }
    }
    // GET /api/workspaces/:id/stats - Get workspace statistics
    static async getStats(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            const stats = await WorkspaceService.getStats(id, userId);
            return res.json({
                success: true,
                data: stats,
            });
        }
        catch (error) {
            console.error('Get stats error:', error);
            if (error.message === 'Unauthorized') {
                return res.status(403).json({
                    success: false,
                    message: 'You do not have permission to view workspace statistics',
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to fetch statistics',
            });
        }
    }
    // POST /api/workspaces/invitations/:token/accept - Accept invitation
    static async acceptInvitation(req, res) {
        try {
            const { token } = req.params;
            const userId = req.user.id;
            const workspace = await WorkspaceService.acceptInvitation(token, userId);
            return res.json({
                success: true,
                data: workspace,
                message: 'Invitation accepted successfully',
            });
        }
        catch (error) {
            console.error('Accept invitation error:', error);
            return res.status(400).json({
                success: false,
                message: error.message || 'Failed to accept invitation',
            });
        }
    }
    // POST /api/workspaces/:id/leave - Leave workspace
    static async leaveWorkspace(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id;
            await WorkspaceService.leaveWorkspace(id, userId);
            return res.json({
                success: true,
                message: 'You have left the workspace',
            });
        }
        catch (error) {
            console.error('Leave workspace error:', error);
            if (error.message === 'Not a member of this workspace') {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
            if (error.message === 'Owner cannot leave workspace. Transfer ownership first.') {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
            return res.status(500).json({
                success: false,
                message: error.message || 'Failed to leave workspace',
            });
        }
    }
}
//# sourceMappingURL=workspace.controller.js.map