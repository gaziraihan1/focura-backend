// types/notification.types.ts
import { NotificationType } from "@prisma/client";

export interface CreateNotificationDTO {
  userId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}

export interface NotificationWithSender {
  id: string;
  userId: string;
  senderId: string | null;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  readAt: Date | null;
  actionUrl: string | null;
  createdAt: Date;
  sender: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

// Notification configuration
export const NOTIFICATION_CONFIG = {
  TASK_DUE_REMINDERS: [
    { label: "6h", ms: 6 * 60 * 60 * 1000 },
    { label: "3h", ms: 3 * 60 * 60 * 1000 },
    { label: "30m", ms: 30 * 60 * 1000 },
  ],
  TASK_OVERDUE_REMINDERS: [
    { label: "1h", ms: 1 * 60 * 60 * 1000 },
    { label: "6h", ms: 6 * 60 * 60 * 1000 },
    { label: "24h", ms: 24 * 60 * 60 * 1000 },
  ],
  PAGINATION: {
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
} as const;

// Notification templates
export const NOTIFICATION_TEMPLATES = {
  TASK_ASSIGNED: (taskTitle: string, assignerName: string) => ({
    title: "New Task Assigned",
    message: `${assignerName} assigned you to "${taskTitle}"`,
  }),
  TASK_COMPLETED: (taskTitle: string, completerName: string) => ({
    title: "Task Completed",
    message: `${completerName} completed "${taskTitle}"`,
  }),
  TASK_COMMENTED: (taskTitle: string, commenterName: string) => ({
    title: "New Comment",
    message: `${commenterName} commented on "${taskTitle}"`,
  }),
  TASK_DUE_SOON: (taskTitle: string, timeLeft: string) => ({
    title: "Task Due Soon",
    message: `"${taskTitle}" is due in ${timeLeft}`,
  }),
  TASK_OVERDUE: (taskTitle: string, timeOverdue: string) => ({
    title: "Task Overdue",
    message: `"${taskTitle}" is overdue by ${timeOverdue}`,
  }),
  MENTION: (mentionerName: string, context: string) => ({
    title: "You Were Mentioned",
    message: `${mentionerName} mentioned you in ${context}`,
  }),
  WORKSPACE_INVITE: (workspaceName: string, inviterName: string) => ({
    title: "Workspace Invitation",
    message: `${inviterName} invited you to join "${workspaceName}"`,
  }),
  PROJECT_UPDATE: (projectName: string, updaterName: string) => ({
    title: "Project Updated",
    message: `${updaterName} updated "${projectName}"`,
  }),
  FILE_SHARED: (fileName: string, sharerName: string) => ({
    title: "File Shared",
    message: `${sharerName} shared "${fileName}" with you`,
  }),
  DEADLINE_REMINDER: (itemName: string, deadline: string) => ({
    title: "Deadline Reminder",
    message: `"${itemName}" deadline is on ${deadline}`,
  }),
} as const;