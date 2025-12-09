import { Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
export declare const NotificationController: {
    getNotifications(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    getUnreadCount(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    markAsRead(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    markAllAsRead(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    deleteNotification(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    deleteAllRead(req: AuthRequest, res: Response): Promise<Response<any, Record<string, any>>>;
};
