/**
 * notification.query.ts
 */

import { prisma } from "../../index.js";
import { notificationInclude } from "./notification.selects.js";
import type { PaginatedNotifications } from "./notification.types.js";

export const NotificationQuery = {
  async getUserNotifications(
    userId: string,
    cursor?: string,
  ): Promise<PaginatedNotifications> {
    const pageSize = 20;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      take: pageSize + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: "desc" },
      include: notificationInclude,
    });

    const hasMore = notifications.length > pageSize;
    const items = hasMore ? notifications.slice(0, -1) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return { items, nextCursor, hasMore };
  },

  async getUnreadCount(userId: string) {
    const count = await prisma.notification.count({
      where: { userId, read: false },
    });
    return { count };
  },
};
