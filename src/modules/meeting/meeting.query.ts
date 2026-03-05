import { prisma } from "../../index.js";
import { meetingSelect } from "./meeting.select.js";
import type { MeetingStatus } from "@prisma/client";

export const MeetingQuery = {
  async listForUser(params: {
    workspaceId: string;
    userId: string;
    isAdmin: boolean;
    status?: MeetingStatus;
    upcoming?: boolean;
    cursor?: string;
    limit?: number;
  }) {
    const take = Math.min(params.limit ?? 20, 50);

    const where = {
      workspaceId: params.workspaceId,
      ...(params.status && { status: params.status }),
      ...(params.upcoming && { startTime: { gte: new Date() } }),
      ...(!params.isAdmin && {
        OR: [
          { visibility: "PUBLIC" as const },
          { attendees: { some: { userId: params.userId } } },
        ],
      }),
    };

    const [meetings, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        select: meetingSelect,
        orderBy: { startTime: "asc" },
        take,
        ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
      }),
      prisma.meeting.count({ where }),
    ]);

    const nextCursor =
      meetings.length === take ? meetings[meetings.length - 1].id : null;

    return { meetings, total, nextCursor };
  },

  async findById(meetingId: string) {
    return prisma.meeting.findUnique({
      where: { id: meetingId },
      select: meetingSelect,
    });
  },

  async canUserAccess(meetingId: string, userId: string, isAdmin: boolean) {
    if (isAdmin) return true;
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        visibility: true,
        attendees: { where: { userId }, select: { id: true } },
      },
    });
    if (!meeting) return false;
    if (meeting.visibility === "PUBLIC") return true;
    return meeting.attendees.length > 0;
  },
};
