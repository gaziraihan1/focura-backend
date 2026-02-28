/**
 * notification.helpers.ts
 * Responsibility: High-level notification utilities for bulk operations.
 * 
 * Functions:
 * - notifyUser: Core function (creates notification + sends via SSE)
 * - notifyTaskAssignees: Notify all assignees of a task
 * - notifyWorkspaceMembers: Notify workspace members (with role filter)
 * - notifyProjectMembers: Notify all users assigned to project tasks
 * - parseMentions: Parse @username mentions from text
 * - notifyMentions: Notify users mentioned in comments/descriptions
 */

import { prisma } from '../../index.js';
import { NotificationMutation } from './notification.mutation.js';
import { sendNotificationToUser } from '../../sockets/notification.stream.js';
import type { NotificationType } from '@prisma/client';

// ==================== CORE ====================

/**
 * Create a notification in DB and immediately push it to the user's SSE stream.
 * Every other helper ultimately calls this function.
 */
export async function notifyUser(params: {
  userId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}) {
  const notification = await NotificationMutation.create(params);
  sendNotificationToUser(params.userId, notification);
  return notification;
}

// ==================== TASK ====================

/**
 * Notify all assignees of a task.
 * 
 * @example
 * await notifyTaskAssignees({
 *   taskId: "task123",
 *   senderId: req.user.id,
 *   type: "TASK_ASSIGNED",
 *   title: "New Task Assigned",
 *   message: `You were assigned to "${task.title}"`,
 *   excludeUserId: req.user.id, // don't notify the person who made the change
 * });
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
          user: { select: { id: true, notifications: true } },
        },
      },
    },
  });

  if (!task?.assignees?.length) return [];

  const eligible = task.assignees.filter((a) => {
    if (params.excludeUserId && a.userId === params.excludeUserId) return false;
    if (!a.user.notifications) return false;
    return true;
  });

  const results = await Promise.allSettled(
    eligible.map((a) =>
      notifyUser({
        userId: a.userId,
        senderId: params.senderId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: `/dashboard/tasks/${params.taskId}`,
      })
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ==================== WORKSPACE ====================

/**
 * Notify all members of a workspace (optionally filtered by role).
 * 
 * @example
 * await notifyWorkspaceMembers({
 *   workspaceId: "ws123",
 *   senderId: req.user.id,
 *   type: "WORKSPACE_UPDATE",
 *   title: "Workspace Updated",
 *   message: "The workspace settings have been updated",
 *   actionUrl: `/dashboard/workspace/${workspaceId}`,
 *   excludeUserId: req.user.id,
 *   role: "MEMBER", // optional: only notify a specific role
 * });
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
      user: { select: { id: true, notifications: true } },
    },
  });

  const eligible = members.filter((m) => {
    if (params.excludeUserId && m.userId === params.excludeUserId) return false;
    if (!m.user.notifications) return false;
    return true;
  });

  const results = await Promise.allSettled(
    eligible.map((m) =>
      notifyUser({
        userId: m.userId,
        senderId: params.senderId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
      })
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ==================== PROJECT ====================

/**
 * Notify all unique users assigned to any task in a project.
 * 
 * @example
 * await notifyProjectMembers({
 *   projectId: "proj123",
 *   senderId: req.user.id,
 *   type: "PROJECT_UPDATE",
 *   title: "Project Updated",
 *   message: `"${project.name}" has been updated`,
 *   actionUrl: `/dashboard/projects/${projectId}`,
 *   excludeUserId: req.user.id,
 * });
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
    where: { task: { projectId: params.projectId } },
    distinct: ['userId'],
    include: {
      user: { select: { id: true, notifications: true } },
    },
  });

  const eligible = assignees.filter((a) => {
    if (params.excludeUserId && a.userId === params.excludeUserId) return false;
    if (!a.user.notifications) return false;
    return true;
  });

  const results = await Promise.allSettled(
    eligible.map((a) =>
      notifyUser({
        userId: a.userId,
        senderId: params.senderId,
        type: params.type,
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
      })
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value);
}

// ==================== MENTIONS ====================

/**
 * Parse @username mentions from text and return matching user IDs
 * that are members of the given workspace.
 */
export async function parseMentions(text: string, workspaceId: string): Promise<string[]> {
  const usernames = [...text.matchAll(/@(\w+)/g)].map((m) => m[1]);
  if (!usernames.length) return [];

  const users = await prisma.user.findMany({
    where: {
      name: { in: usernames },
      workspaceMembers: { some: { workspaceId } },
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
}

/**
 * Notify users @mentioned in a comment or description.
 * Skips the sender and users with notifications disabled.
 * 
 * @example
 * await notifyMentions({
 *   text: comment.content,
 *   workspaceId: workspace.id,
 *   senderId: req.user.id,
 *   senderName: req.user.name,
 *   context: "a comment",
 *   actionUrl: `/dashboard/tasks/${taskId}`,
 * });
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
  if (!mentionedUserIds.length) return [];

  // Single query to get all preferences at once
  const users = await prisma.user.findMany({
    where: { id: { in: mentionedUserIds } },
    select: { id: true, notifications: true },
  });

  const eligible = users.filter((u) => u.id !== params.senderId && u.notifications);

  const results = await Promise.allSettled(
    eligible.map((u) =>
      notifyUser({
        userId: u.id,
        senderId: params.senderId,
        type: 'MENTION',
        title: 'You Were Mentioned',
        message: `${params.senderName} mentioned you in ${params.context}`,
        actionUrl: params.actionUrl,
      })
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value);
}