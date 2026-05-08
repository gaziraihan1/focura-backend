
import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.js";
import { NotificationQuery } from "./notification.query.js";
import { NotificationMutation } from "./notification.mutation.js";

function requireUserId(req: AuthRequest, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return null;
  }
  return req.user.id;
}

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const cursor = req.query.cursor as string | undefined;
    const notifications = await NotificationQuery.getUserNotifications(
      userId,
      cursor,
    );
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error("Get notifications error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch notifications" });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const count = await NotificationQuery.getUnreadCount(userId);
    res.json({ success: true, data: count });
  } catch (error) {
    console.error("Get unread count error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch unread count" });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const notification = await NotificationMutation.markAsRead(req.params.id);
    res.json({ success: true, data: notification });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const result = await NotificationMutation.markAllAsRead(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to mark all as read" });
  }
};

export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    await NotificationMutation.deleteNotification(req.params.id);
    res.json({ success: true, message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Delete notification error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete notification" });
  }
};

export const deleteAllRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = requireUserId(req, res);
    if (!userId) return;

    const result =
      await NotificationMutation.deleteAllReadNotifications(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Delete all read error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete notifications" });
  }
};
