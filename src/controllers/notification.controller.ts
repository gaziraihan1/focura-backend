import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { NotificationService } from "../services/notification.service.js";

export const NotificationController = {
    async getNotifications(req: AuthRequest, res: Response) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const cursor = req.query.cursor as string | undefined;

        const notifications = await NotificationService.getUserNotifications(
            req.user.id,
            cursor
        );

        return res.json({
            success: true,
            data: notifications,
        });
    },

    async getUnreadCount(req: AuthRequest, res: Response) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const count = await NotificationService.getUnreadCount(req.user.id);

        return res.json({
            success: true,
            data: count,
        });
    },

    async markAsRead(req: AuthRequest, res: Response) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const notification = await NotificationService.markAsRead(req.params.id);

        return res.json({
            success: true,
            data: notification,
        });
    },

    async markAllAsRead(req: AuthRequest, res: Response) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const result = await NotificationService.markAllAsRead(req.user.id);

        return res.json({
            success: true,
            data: result,
        });
    },

    async deleteNotification(req: AuthRequest, res: Response) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        await NotificationService.deleteNotification(req.params.id);

        return res.json({
            success: true,
            message: "Notification deleted successfully",
        });
    },

    async deleteAllRead(req: AuthRequest, res: Response) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        const result = await NotificationService.deleteAllReadNotifications(req.user.id);

        return res.json({
            success: true,
            data: result,
        });
    }
};