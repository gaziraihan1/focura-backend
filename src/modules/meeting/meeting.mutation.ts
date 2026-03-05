import { prisma } from "../../index.js";
import { meetingSelect } from "./meeting.select.js";
import type {
  CreateMeetingInput,
  UpdateMeetingInput,
} from "./meeting.types.js";

export const MeetingMutation = {
  async create(params: {
    input: CreateMeetingInput;
    workspaceId: string;
    createdById: string;
  }) {
    const { input, workspaceId, createdById } = params;

    return prisma.meeting.create({
      data: {
        title: input.title,
        description: input.description,
        link: input.link,
        location: input.location,
        visibility: input.visibility,
        startTime: new Date(input.startTime),
        endTime: new Date(input.endTime),
        workspaceId,
        createdById,
        ...(input.attendeeIds?.length && {
          attendees: {
            createMany: {
              data: input.attendeeIds.map((userId) => ({ userId })),
              skipDuplicates: true,
            },
          },
        }),
      },
      select: meetingSelect,
    });
  },

  async update(params: { meetingId: string; input: UpdateMeetingInput }) {
    const { meetingId, input } = params;

    return prisma.$transaction(async (tx) => {
      const meeting = await tx.meeting.update({
        where: { id: meetingId },
        data: {
          ...(input.title && { title: input.title }),
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.link !== undefined && { link: input.link }),
          ...(input.location !== undefined && { location: input.location }),
          ...(input.visibility && { visibility: input.visibility }),
          ...(input.status && { status: input.status }),
          ...(input.startTime && { startTime: new Date(input.startTime) }),
          ...(input.endTime && { endTime: new Date(input.endTime) }),
        },
        select: meetingSelect,
      });

      // If attendees list is explicitly provided, replace them
      if (input.attendeeIds !== undefined) {
        await tx.meetingAttendee.deleteMany({ where: { meetingId } });
        if (input.attendeeIds.length > 0) {
          await tx.meetingAttendee.createMany({
            data: input.attendeeIds.map((userId) => ({ meetingId, userId })),
            skipDuplicates: true,
          });
        }
      }

      return meeting;
    });
  },

  async cancel(meetingId: string) {
    return prisma.meeting.update({
      where: { id: meetingId },
      data: { status: "CANCELLED" },
      select: meetingSelect,
    });
  },

  async delete(meetingId: string) {
    await prisma.meeting.delete({ where: { id: meetingId } });
  },
};
