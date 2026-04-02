import { Response } from "express";
import { z } from "zod";
import type { AuthRequest } from "../middleware/auth.js";
import { AdminRepository } from "./admin.repository.js";
import { isFocuraAdmin } from "../config/admin.config.js";

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  workspaceId: z.string().optional(),
});

function guardAdmin(req: AuthRequest, res: Response): boolean {
  if (!isFocuraAdmin(req.user!.id)) {
    res
      .status(403)
      .json({ success: false, message: "Focura admin access required" });
    return false;
  }
  return true;
}

function handleError(res: Response, label: string, error: unknown) {
  console.error(`Admin ${label} error:`, error);
  res.status(500).json({ success: false, message: `Failed to ${label}` });
}

export const getAdminStats = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const data = await AdminRepository.getStats();
    res.json({ success: true, data });
  } catch (e) {
    handleError(res, "fetch stats", e);
  }
};

export const getAdminWorkspaces = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const params = paginationSchema.parse(req.query);
    const result = await AdminRepository.getWorkspaces(params);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, "fetch workspaces", e);
  }
};

// By SLUG not id
export const getAdminWorkspaceDetail = async (
  req: AuthRequest,
  res: Response,
) => {
  if (!guardAdmin(req, res)) return;
  try {
    const workspace = await AdminRepository.getWorkspaceDetailBySlug(
      req.params.slug,
    );
    if (!workspace) {
      res.status(404).json({ success: false, message: "Workspace not found" });
      return;
    }
    res.json({ success: true, data: workspace });
  } catch (e) {
    handleError(res, "fetch workspace detail", e);
  }
};

export const getAdminUsers = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const params = paginationSchema.parse(req.query);
    const result = await AdminRepository.getUsers(params);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, "fetch users", e);
  }
};

export const getAdminUserDetail = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const user = await AdminRepository.getUserDetail(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }
    res.json({ success: true, data: user });
  } catch (e) {
    handleError(res, "fetch user detail", e);
  }
};

export const getAdminProjects = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const params = paginationSchema.parse(req.query);
    const result = await AdminRepository.getProjects(params);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, "fetch projects", e);
  }
};

export const getAdminBilling = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const params = paginationSchema.parse(req.query);
    const result = await AdminRepository.getBilling(params);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, "fetch billing", e);
  }
};

export const getAdminActivity = async (req: AuthRequest, res: Response) => {
  if (!guardAdmin(req, res)) return;
  try {
    const params = paginationSchema.parse(req.query);
    const result = await AdminRepository.getActivity(params);
    res.json({ success: true, ...result });
  } catch (e) {
    handleError(res, "fetch activity", e);
  }
};
