import { prisma } from "../../index.js";
import {
  notifyUser,
  notifyWorkspaceMembers,
} from "../notification/notification.helpers.js";
import type { MeetingPayload } from "./meeting.select.js";

function formatMeetingTime(date: Date): string {
  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export async function notifyMeetingCreatedPrivate(params: {
  meeting: MeetingPayload;
  senderId: string;
  senderName: string;
}) {
  const { meeting, senderId, senderName } = params;
  const attendeeIds = meeting.attendees
    .map((a) => a.userId)
    .filter((id) => id !== senderId);

  if (!attendeeIds.length) return;

  const users = await prisma.user.findMany({
    where: { id: { in: attendeeIds } },
    select: { id: true, notifications: true },
  });

  const eligible = users.filter((u) => u.notifications);

  await Promise.allSettled(
    eligible.map((u) =>
      notifyUser({
        userId: u.id,
        senderId,
        type: "MEETING_CREATED",
        title: "You have been invited to a meeting",
        message: `${senderName} invited you to "${meeting.title}" on ${formatMeetingTime(new Date(meeting.startTime))}`,
        actionUrl: `/dashboard/meetings/${meeting.id}`,
      }),
    ),
  );
}

export async function notifyMeetingCreatedPublic(params: {
  meeting: MeetingPayload;
  workspaceId: string;
  senderId: string;
  senderName: string;
}) {
  const { meeting, workspaceId, senderId, senderName } = params;

  await notifyWorkspaceMembers({
    workspaceId,
    senderId,
    type: "MEETING_CREATED",
    title: "New meeting scheduled",
    message: `${senderName} scheduled "${meeting.title}" on ${formatMeetingTime(new Date(meeting.startTime))}`,
    actionUrl: `/dashboard/meetings/${meeting.id}`,
    excludeUserId: senderId,
  });
}

export async function notifyMeetingUpdated(params: {
  meeting: MeetingPayload;
  workspaceId: string;
  senderId: string;
  senderName: string;
  isAdmin: boolean;
}) {
  const { meeting, workspaceId, senderId, senderName, isAdmin } = params;

  if (meeting.visibility === "PUBLIC" && isAdmin) {
    await notifyWorkspaceMembers({
      workspaceId,
      senderId,
      type: "MEETING_UPDATED",
      title: "Meeting updated",
      message: `${senderName} updated "${meeting.title}"`,
      actionUrl: `/dashboard/meetings/${meeting.id}`,
      excludeUserId: senderId,
    });
  } else {
    const attendeeIds = meeting.attendees
      .map((a) => a.userId)
      .filter((id) => id !== senderId);

    if (!attendeeIds.length) return;

    const users = await prisma.user.findMany({
      where: { id: { in: attendeeIds } },
      select: { id: true, notifications: true },
    });

    await Promise.allSettled(
      users
        .filter((u) => u.notifications)
        .map((u) =>
          notifyUser({
            userId: u.id,
            senderId,
            type: "MEETING_UPDATED",
            title: "Meeting updated",
            message: `${senderName} updated "${meeting.title}"`,
            actionUrl: `/dashboard/meetings/${meeting.id}`,
          }),
        ),
    );
  }
}

export async function notifyMeetingCancelled(params: {
  meeting: MeetingPayload;
  workspaceId: string;
  senderId: string;
  senderName: string;
}) {
  const { meeting, workspaceId, senderId, senderName } = params;

  if (meeting.visibility === "PUBLIC") {
    await notifyWorkspaceMembers({
      workspaceId,
      senderId,
      type: "MEETING_CANCELLED",
      title: "Meeting cancelled",
      message: `${senderName} cancelled "${meeting.title}"`,
      actionUrl: `/dashboard/meetings`,
      excludeUserId: senderId,
    });
  } else {
    const attendeeIds = meeting.attendees
      .map((a) => a.userId)
      .filter((id) => id !== senderId);

    if (!attendeeIds.length) return;

    const users = await prisma.user.findMany({
      where: { id: { in: attendeeIds } },
      select: { id: true, notifications: true },
    });

    await Promise.allSettled(
      users
        .filter((u) => u.notifications)
        .map((u) =>
          notifyUser({
            userId: u.id,
            senderId,
            type: "MEETING_CANCELLED",
            title: "Meeting cancelled",
            message: `${senderName} cancelled "${meeting.title}"`,
            actionUrl: `/dashboard/meetings`,
          }),
        ),
    );
  }
}
