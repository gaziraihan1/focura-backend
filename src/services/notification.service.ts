import { prisma } from "../index.js";
import { NotificationType } from "@prisma/client";

export const NotificationService = {
    async getUserNotifications(userId: string, cursor?: string) {
        const pageSize = 20;

        const notifications = await prisma.notification.findMany({
            where: { userId },
            take: pageSize + 1,
            ...(cursor && {
                cursor: { id: cursor },
                skip: 1,
            }),
            orderBy: { createdAt: "desc" },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
            },
        });

        const hasMore = notifications.length > pageSize;
        const items = hasMore ? notifications.slice(0, -1) : notifications;
        const nextCursor = hasMore ? items[items.length - 1].id : null;

        return {
            items,
            nextCursor,
            hasMore,
        };
    },

    async getUnreadCount(userId: string) {
        const count = await prisma.notification.count({
            where: {
                userId,
                read: false,
            },
        });

        return { count };
    },

    async markAsRead(notificationId: string) {
        const notification = await prisma.notification.update({
            where: { id: notificationId },
            data: {
                read: true,
                readAt: new Date(),
            },
        });

        return notification;
    },

    async markAllAsRead(userId: string) {
        const result = await prisma.notification.updateMany({
            where: {
                userId,
                read: false,
            },
            data: {
                read: true,
                readAt: new Date(),
            },
        });

        return { count: result.count };
    },

    async deleteNotification(notificationId: string) {
        await prisma.notification.delete({
            where: { id: notificationId },
        });
    },

    async deleteAllReadNotifications(userId: string) {
        const result = await prisma.notification.deleteMany({
            where: {
                userId,
                read: true,
            },
        });

        return { count: result.count };
    },

    async deleteOldReadNotifications(daysOld: number) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const result = await prisma.notification.deleteMany({
            where: {
                read: true,
                readAt: {
                    lt: cutoffDate,
                },
            },
        });

        return { count: result.count };
    },

    async create(data: {
        userId: string;
        type: NotificationType;
        title: string;
        message: string;
        actionUrl?: string;
        senderId?: string;
    }) {
        const notification = await prisma.notification.create({
            data,
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        image: true,
                    },
                },
            },
        });

        return notification;
    },
};