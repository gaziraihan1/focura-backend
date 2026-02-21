import type { Response, Request } from "express";
import { z } from "zod";
import type { AuthRequest } from "../../middleware/auth.js";
import {
  WorkspaceQuery,
  WorkspaceMutation,
  WorkspaceActivity,
  WorkspaceNotifications,
} from "./index.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
} from "./workspace.validators.js";
import { prisma } from "../../index.js";

function handleError(res: Response, label: string, error: unknown): void {
  if (error instanceof z.ZodError) {
    res
      .status(400)
      .json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    return;
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (msg === "Unauthorized")
      res.status(403).json({ success: false, message: msg });
    else if (msg === "Workspace not found" || msg === "Invitation not found")
      res.status(404).json({ success: false, message: msg });
    else if (
      msg.includes("limit reached") ||
      msg.includes("already invited") ||
      msg.includes("already a member")
    )
      res.status(400).json({ success: false, message: msg });
    else
      res.status(500).json({ success: false, message: `Failed to ${label}` });
  } else {
    res.status(500).json({ success: false, message: `Failed to ${label}` });
  }
}

export const getAllWorkspaces = async (req: AuthRequest, res: Response) => {
  try {
    const workspaces = await WorkspaceQuery.getUserWorkspaces(req.user!.id);
    res.json({ success: true, data: workspaces });
  } catch (error) {
    handleError(res, "fetch workspaces", error);
  }
};

export const createWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const data = createWorkspaceSchema.parse(req.body);
    const workspace = await WorkspaceMutation.create(
      req.user!.id,
      data,
      async ({ workspace }) => {
        void WorkspaceActivity.logCreated({
          workspaceId: workspace.id,
          userId: req.user!.id,
          workspaceName: workspace.name,
        });
      },
    );
    res
      .status(201)
      .json({
        success: true,
        data: workspace,
        message: "Workspace created successfully",
      });
  } catch (error) {
    handleError(res, "create workspace", error);
  }
};

export const getWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;
    const isId = slug.startsWith("cml") && slug.length > 20;
    const workspace = isId
      ? await WorkspaceQuery.getById(slug, req.user!.id)
      : await WorkspaceQuery.getBySlug(slug, req.user!.id);
    res.json({ success: true, data: workspace });
  } catch (error) {
    handleError(res, "fetch workspace", error);
  }
};

export const updateWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    const data = updateWorkspaceSchema.parse(req.body);
    const workspace = await WorkspaceMutation.update(
      req.params.id,
      req.user!.id,
      data,
      async ({ workspaceId }) => {
        void WorkspaceActivity.logUpdated({
          workspaceId,
          userId: req.user!.id,
        });
      },
    );
    res.json({
      success: true,
      data: workspace,
      message: "Workspace updated successfully",
    });
  } catch (error) {
    handleError(res, "update workspace", error);
  }
};

export const deleteWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    await WorkspaceMutation.delete(req.params.id, req.user!.id);
    res.json({ success: true, message: "Workspace deleted successfully" });
  } catch (error) {
    handleError(res, "delete workspace", error);
  }
};

export const getMembers = async (req: AuthRequest, res: Response) => {
  try {
    const members = await WorkspaceQuery.getMembers(
      req.params.id,
      req.user!.id,
    );
    res.json({ success: true, data: members });
  } catch (error) {
    handleError(res, "fetch members", error);
  }
};

export const inviteMember = async (req: AuthRequest, res: Response) => {
  try {
    const data = inviteMemberSchema.parse(req.body);
    const invitation = await WorkspaceMutation.inviteMember(
      req.params.id,
      req.user!.id,
      data.email,
      data.role,
      async ({ invitation, inviterName }) => {
        const invitedUser = await prisma.user.findUnique({
          where: { email: data.email },
          select: { id: true, notifications: true },
        });
        if (invitedUser?.notifications && invitation.workspace) {
          void WorkspaceNotifications.notifyInvited({
            invitedUserId: invitedUser.id,
            inviterId: req.user!.id,
            inviterName,
            workspaceName: invitation.workspace.name,
            token: invitation.token,
          });
        }
      },
    );
    res.json({
      success: true,
      data: invitation,
      message: "Invitation sent successfully",
    });
  } catch (error) {
    handleError(res, "send invitation", error);
  }
};

export const getInvitation = async (req: Request, res: Response) => {
  try {
    const invitation = await WorkspaceQuery.getInvitationByToken(
      req.params.token,
    );
    res.json({ success: true, data: invitation });
  } catch (error) {
    handleError(res, "fetch invitation", error);
  }
};

export const acceptInvitation = async (req: AuthRequest, res: Response) => {
  try {
    const workspace = await WorkspaceMutation.acceptInvitation(
      req.params.token,
      req.user!.id,
      async ({ workspace, invitedBy, userName }) => {
        const inviter = await prisma.user.findUnique({
          where: { id: invitedBy },
          select: { notifications: true },
        });
        if (inviter?.notifications) {
          void WorkspaceNotifications.notifyAccepted({
            inviterId: invitedBy,
            userId: req.user!.id,
            userName,
            workspaceName: workspace.name,
            workspaceSlug: workspace.slug,
          });
        }
        void WorkspaceNotifications.notifyAdmins({
          workspaceId: workspace.id,
          excludeUserId: invitedBy,
          senderId: req.user!.id,
          senderName: userName,
          workspaceName: workspace.name,
          workspaceSlug: workspace.slug,
        });
      },
    );
    res.json({
      success: true,
      data: workspace,
      message: "Invitation accepted successfully",
    });
  } catch (error) {
    handleError(res, "accept invitation", error);
  }
};

export const removeMember = async (req: AuthRequest, res: Response) => {
  try {
    await WorkspaceMutation.removeMember(
      req.params.id,
      req.user!.id,
      req.params.memberId,
      async ({ member }) => {
        if (member.user.notifications) {
          void WorkspaceNotifications.notifyRemoved({
            removedUserId: member.userId,
            removerId: req.user!.id,
            workspaceName: member.workspace.name,
          });
        }
      },
    );
    res.json({ success: true, message: "Member removed successfully" });
  } catch (error) {
    handleError(res, "remove member", error);
  }
};

export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    const member = await WorkspaceMutation.updateMemberRole(
      req.params.id,
      req.user!.id,
      req.params.memberId,
      role,
      async ({ member, workspaceName }) => {
        if (member.user.notifications) {
          void WorkspaceNotifications.notifyRoleChanged({
            userId: member.userId,
            updaterId: req.user!.id,
            workspaceName,
            workspaceId: req.params.id,
            role,
          });
        }
      },
    );
    res.json({
      success: true,
      data: member,
      message: "Member role updated successfully",
    });
  } catch (error) {
    handleError(res, "update member role", error);
  }
};

export const getStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await WorkspaceQuery.getStats(req.params.id, req.user!.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    handleError(res, "fetch statistics", error);
  }
};

export const leaveWorkspace = async (req: AuthRequest, res: Response) => {
  try {
    await WorkspaceMutation.leaveWorkspace(req.params.id, req.user!.id);
    res.json({ success: true, message: "You have left the workspace" });
  } catch (error) {
    handleError(res, "leave workspace", error);
  }
};
