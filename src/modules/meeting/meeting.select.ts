import { Prisma } from "@prisma/client";

export const meetingAttendeeSelect = {
  id: true,
  userId: true,
  joinedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
} satisfies Prisma.MeetingAttendeeSelect;

export const meetingSelect = {
  id: true,
  title: true,
  description: true,
  link: true,
  location: true,
  visibility: true,
  status: true,
  startTime: true,
  endTime: true,
  createdAt: true,
  updatedAt: true,
  workspaceId: true,
  createdById: true,
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  },
  attendees: {
    select: meetingAttendeeSelect,
    orderBy: { joinedAt: "asc" as const },
  },
} satisfies Prisma.MeetingSelect;

export type MeetingPayload = Prisma.MeetingGetPayload<{
  select: typeof meetingSelect;
}>;
