
import { sendNotificationToUser } from "../sockets/notification.stream.js";
import { NotificationType } from "@prisma/client";
import { prisma } from "../index.js";
import { NotificationMutation } from "../modules/notification/notification.mutation.js";

export async function notifyUser(params: {
  userId:     string;
  senderId?:  string;
  type:       NotificationType;
  title:      string;
  message:    string;
  actionUrl?: string;
}) {
  const notification = await NotificationMutation.create(params);
  sendNotificationToUser(params.userId, notification);
  return notification;
}

export async function notifyTaskAssignees(params: {
  taskId:         string;
  senderId?:      string;
  type:           NotificationType;
  title:          string;
  message:        string;
  excludeUserId?: string;
}) {
  const task = await prisma.task.findUnique({
    where:   { id: params.taskId },
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
        userId:    a.userId,
        senderId:  params.senderId,
        type:      params.type,
        title:     params.title,
        message:   params.message,
        actionUrl: `/dashboard/tasks/${params.taskId}`,
      })
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function notifyWorkspaceMembers(params: {
  workspaceId:    string;
  senderId?:      string;
  type:           NotificationType;
  title:          string;
  message:        string;
  actionUrl?:     string;
  excludeUserId?: string;
  role?:          string;
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
        userId:    m.userId,
        senderId:  params.senderId,
        type:      params.type,
        title:     params.title,
        message:   params.message,
        actionUrl: params.actionUrl,
      })
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function notifyProjectMembers(params: {
  projectId:      string;
  senderId?:      string;
  type:           NotificationType;
  title:          string;
  message:        string;
  actionUrl?:     string;
  excludeUserId?: string;
}) {
  const assignees = await prisma.taskAssignee.findMany({
    where:    { task: { projectId: params.projectId } },
    distinct: ["userId"],
    include:  {
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
        userId:    a.userId,
        senderId:  params.senderId,
        type:      params.type,
        title:     params.title,
        message:   params.message,
        actionUrl: params.actionUrl,
      })
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function parseMentions(
  text:        string,
  workspaceId: string
): Promise<string[]> {
  const usernames = [...text.matchAll(/@(\w+)/g)].map((m) => m[1]);
  if (!usernames.length) return [];

  const users = await prisma.user.findMany({
    where: {
      name:             { in: usernames },
      workspaceMembers: { some: { workspaceId } },
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
}

export async function notifyMentions(params: {
  text:        string;
  workspaceId: string;
  senderId:    string;
  senderName:  string;
  context:     string;
  actionUrl:   string;
}) {
  const mentionedUserIds = await parseMentions(params.text, params.workspaceId);
  if (!mentionedUserIds.length) return [];

  const users = await prisma.user.findMany({
    where:  { id: { in: mentionedUserIds } },
    select: { id: true, notifications: true },
  });

  const eligible = users.filter(
    (u) => u.id !== params.senderId && u.notifications
  );

  const results = await Promise.allSettled(
    eligible.map((u) =>
      notifyUser({
        userId:    u.id,
        senderId:  params.senderId,
        type:      "MENTION",
        title:     "You Were Mentioned",
        message:   `${params.senderName} mentioned you in ${params.context}`,
        actionUrl: params.actionUrl,
      })
    )
  );

  return results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
    .map((r) => r.value);
}