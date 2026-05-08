import { prisma } from "../../lib/prisma.js";
import { meetingSelect } from "./meeting.select.js";

// ✅ FIX: split type + runtime imports correctly
import { Prisma } from "@prisma/client";
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

    const where: Prisma.MeetingWhereInput = {
      workspaceId: params.workspaceId,

      ...(params.status && { status: params.status }),

      ...(params.upcoming && {
        startTime: { gte: new Date() },
      }),

      ...(!params.isAdmin && {
        OR: [
          { visibility: "PUBLIC" },
          {
            attendees: {
              some: { userId: params.userId },
            },
          },
        ],
      }),
    };

    try {
      const [meetings, total] = await Promise.all([
        prisma.meeting.findMany({
          where,
          select: meetingSelect,
          orderBy: { startTime: "asc" },
          take,
          ...(params.cursor && {
            cursor: { id: params.cursor },
            skip: 1,
          }),
        }),

        // ✅ FIX: count fallback safe for CI / edge cases
        prisma.meeting.count
          ? prisma.meeting.count({ where })
          : prisma.meeting
              .findMany({
                where,
                select: { id: true },
              })
              .then((rows) => rows.length),
      ]);

      const nextCursor =
        meetings.length === take
          ? meetings[meetings.length - 1].id
          : null;

      return { meetings, total, nextCursor };
    } catch (error) {
      console.error("[MeetingQuery.listForUser ERROR]", error);
      throw error;
    }
  },

  async findById(meetingId: string) {
    return prisma.meeting.findUnique({
      where: { id: meetingId },
      select: meetingSelect,
    });
  },

  async canUserAccess(
    meetingId: string,
    userId: string,
    isAdmin: boolean
  ) {
    if (isAdmin) return true;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        visibility: true,
        attendees: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!meeting) return false;

    if (meeting.visibility === "PUBLIC") return true;

    return meeting.attendees.length > 0;
  },
};