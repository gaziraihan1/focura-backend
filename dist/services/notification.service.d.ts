import { NotificationType } from "@prisma/client";
export declare const NotificationService: {
    getUserNotifications(userId: string, cursor?: string): Promise<{
        items: ({
            sender: {
                id: string;
                name: string | null;
                email: string;
                image: string | null;
            } | null;
        } & {
            id: string;
            type: import(".prisma/client").$Enums.NotificationType;
            title: string;
            message: string;
            read: boolean;
            actionUrl: string | null;
            createdAt: Date;
            readAt: Date | null;
            userId: string;
            senderId: string | null;
        })[];
        nextCursor: string | null;
        hasMore: boolean;
    }>;
    getUnreadCount(userId: string): Promise<{
        count: number;
    }>;
    markAsRead(notificationId: string): Promise<{
        id: string;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        message: string;
        read: boolean;
        actionUrl: string | null;
        createdAt: Date;
        readAt: Date | null;
        userId: string;
        senderId: string | null;
    }>;
    markAllAsRead(userId: string): Promise<{
        count: number;
    }>;
    deleteNotification(notificationId: string): Promise<void>;
    deleteAllReadNotifications(userId: string): Promise<{
        count: number;
    }>;
    deleteOldReadNotifications(daysOld: number): Promise<{
        count: number;
    }>;
    create(data: {
        userId: string;
        type: NotificationType;
        title: string;
        message: string;
        actionUrl?: string;
        senderId?: string;
    }): Promise<{
        sender: {
            id: string;
            name: string | null;
            email: string;
            image: string | null;
        } | null;
    } & {
        id: string;
        type: import(".prisma/client").$Enums.NotificationType;
        title: string;
        message: string;
        read: boolean;
        actionUrl: string | null;
        createdAt: Date;
        readAt: Date | null;
        userId: string;
        senderId: string | null;
    }>;
};
