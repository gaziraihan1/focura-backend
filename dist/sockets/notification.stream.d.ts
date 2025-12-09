import { Request, Response } from "express";
export declare function notificationStream(req: Request, res: Response): Response<any, Record<string, any>> | undefined;
export declare function sendNotificationToUser(userId: string, notification: any): boolean;
export declare function getActiveConnections(): number;
export declare function getConnectedUsers(): string[];
