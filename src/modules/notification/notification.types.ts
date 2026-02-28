
import { NotificationType } from "@prisma/client";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  senderId?: string;
}

export interface PaginatedNotifications {
  items: any[];
  nextCursor: string | null;
  hasMore: boolean;
}