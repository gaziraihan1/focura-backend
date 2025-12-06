// utils/notification.helpers.ts
import { NotificationService } from "../services/notification.service.js";
import { sendNotificationToUser } from "../sockets/notification.stream.js";
import { NotificationType } from "@prisma/client";
import { prisma } from "../index.js";

/**
 * Send notification to a single user
 */
export async function notifyUser(params: {
  userId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}) {
  const notification = await NotificationService.create(params);
  sendNotificationToUser(params.userId, notification);
  return notification;
}

/**
 * Notify all assignees of a task
 */
export async function notifyTaskAssignees(params: {
  taskId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  excludeUserId?: string;
}) {
  const task = await prisma.task.findUnique({
    where: { id: params.taskId },
    include: {
      assignees: {
        include: { 
          user: {
            select: {
              id: true,
              notifications: true, // Check if user has notifications enabled
            }
          } 
        },
      },
    },
  });

  if (!task) return [];

  const notifications = [];

  for (const assignee of task.assignees) {
    // Skip if user should be excluded
    if (params.excludeUserId && assignee.userId === params.excludeUserId) {
      continue;
    }

    // Skip if user has notifications disabled
    if (!assignee.user.notifications) {
      continue;
    }

    const notification = await notifyUser({
      userId: assignee.userId,
      senderId: params.senderId,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: `/dashboard/tasks/${params.taskId}`,
    });

    notifications.push(notification);
  }

  return notifications;
}

/**
 * Notify all members of a workspace
 */
export async function notifyWorkspaceMembers(params: {
  workspaceId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  excludeUserId?: string;
  role?: string;
}) {
  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId: params.workspaceId,
      ...(params.role && { role: params.role as any }),
    },
    include: { 
      user: {
        select: {
          id: true,
          notifications: true,
        }
      } 
    },
  });

  const notifications = [];

  for (const member of members) {
    // Skip if user should be excluded
    if (params.excludeUserId && member.userId === params.excludeUserId) {
      continue;
    }

    // Skip if user has notifications disabled
    if (!member.user.notifications) {
      continue;
    }

    const notification = await notifyUser({
      userId: member.userId,
      senderId: params.senderId,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
    });

    notifications.push(notification);
  }

  return notifications;
}

/**
 * Notify all members of a project (users assigned to any task in the project)
 */
export async function notifyProjectMembers(params: {
  projectId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  excludeUserId?: string;
}) {
  const assignees = await prisma.taskAssignee.findMany({
    where: {
      task: {
        projectId: params.projectId,
      },
    },
    distinct: ["userId"],
    include: { 
      user: {
        select: {
          id: true,
          notifications: true,
        }
      } 
    },
  });

  const notifications = [];

  for (const assignee of assignees) {
    // Skip if user should be excluded
    if (params.excludeUserId && assignee.userId === params.excludeUserId) {
      continue;
    }

    // Skip if user has notifications disabled
    if (!assignee.user.notifications) {
      continue;
    }

    const notification = await notifyUser({
      userId: assignee.userId,
      senderId: params.senderId,
      type: params.type,
      title: params.title,
      message: params.message,
      actionUrl: params.actionUrl,
    });

    notifications.push(notification);
  }

  return notifications;
}

/**
 * Parse @mentions from text and return user IDs
 */
export async function parseMentions(
  text: string,
  workspaceId: string
): Promise<string[]> {
  const mentionRegex = /@(\w+)/g;
  const matches = [...text.matchAll(mentionRegex)];

  if (matches.length === 0) return [];

  const usernames = matches.map((m) => m[1]);

  const users = await prisma.user.findMany({
    where: {
      name: { in: usernames },
      workspaceMembers: {
        some: { workspaceId },
      },
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
}

/**
 * Notify users mentioned in text (e.g., @username in comments)
 */
export async function notifyMentions(params: {
  text: string;
  workspaceId: string;
  senderId: string;
  senderName: string;
  context: string;
  actionUrl: string;
}) {
  const mentionedUserIds = await parseMentions(params.text, params.workspaceId);

  const notifications = [];

  for (const userId of mentionedUserIds) {
    // Don't notify if user mentions themselves
    if (userId === params.senderId) continue;

    // Check if user has notifications enabled
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { notifications: true },
    });

    if (!user?.notifications) continue;

    const notification = await notifyUser({
      userId,
      senderId: params.senderId,
      type: "MENTION",
      title: "You Were Mentioned",
      message: `${params.senderName} mentioned you in ${params.context}`,
      actionUrl: params.actionUrl,
    });

    notifications.push(notification);
  }

  return notifications;
}