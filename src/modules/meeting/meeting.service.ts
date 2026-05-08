import { MeetingQuery } from "./meeting.query.js";
import { MeetingMutation } from "./meeting.mutation.js";
import {
  notifyMeetingCreatedPrivate,
  notifyMeetingCreatedPublic,
  notifyMeetingUpdated,
  notifyMeetingCancelled,
} from "./meeting.notification.js";
import type {
  CreateMeetingInput,
  UpdateMeetingInput,
  MeetingContext,
} from "./meeting.types.js";

const ADMIN_ROLES = new Set(["OWNER", "ADMIN"]);

function isAdmin(role: string | null | undefined): boolean {
  return role != null && ADMIN_ROLES.has(role);
}

const forbidden = (msg: string) => new Error(`FORBIDDEN: ${msg}`);
const notFound = (msg: string) => new Error(`NOT_FOUND: ${msg}`);
const badRequest = (msg: string) => new Error(`BAD_REQUEST: ${msg}`);

export const MeetingService = {
  async list(
    ctx: MeetingContext,
    query: {
      status?: any;
      upcoming?: boolean;
      cursor?: string;
      limit?: number;
    },
  ) {
    return MeetingQuery.listForUser({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      isAdmin: isAdmin(ctx.workspaceRole),
      ...query,
    });
  },

  async getById(ctx: MeetingContext, meetingId: string) {
    const canAccess = await MeetingQuery.canUserAccess(
      meetingId,
      ctx.userId,
      isAdmin(ctx.workspaceRole),
    );
    if (!canAccess) throw forbidden("You do not have access to this meeting");

    const meeting = await MeetingQuery.findById(meetingId);
    if (!meeting) throw notFound("Meeting not found");
    return meeting;
  },

  async create(
    ctx: MeetingContext,
    input: CreateMeetingInput,
    senderName: string,
  ) {
    if (!isAdmin(ctx.workspaceRole)) {
      throw forbidden("Only admins and owners can create meetings");
    }

    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw badRequest("Invalid date format");
    }
    if (end <= start) {
      throw badRequest("End time must be after start time");
    }
    if (input.visibility === "PRIVATE" && !input.attendeeIds?.length) {
      throw badRequest("Private meetings require at least one attendee");
    }

    const meeting = await MeetingMutation.create({
      input,
      workspaceId: ctx.workspaceId,
      createdById: ctx.userId,
    });

    if (meeting.visibility === "PRIVATE") {
      notifyMeetingCreatedPrivate({
        meeting,
        senderId: ctx.userId,
        workspaceId: ctx.workspaceId,
        senderName,
      }).catch(console.error);
    } else {
      notifyMeetingCreatedPublic({
        meeting,
        workspaceId: ctx.workspaceId,
        senderId: ctx.userId,
        senderName,
      }).catch(console.error);
    }

    return meeting;
  },

  async update(
    ctx: MeetingContext,
    meetingId: string,
    input: UpdateMeetingInput,
    senderName: string,
  ) {
    const existing = await MeetingQuery.findById(meetingId);
    if (!existing) throw notFound("Meeting not found");
    if (existing.workspaceId !== ctx.workspaceId)
      throw forbidden("Meeting does not belong to this workspace");

    const canEdit =
      isAdmin(ctx.workspaceRole) || existing.createdById === ctx.userId;
    if (!canEdit) throw forbidden("You cannot edit this meeting");

    if (existing.status === "CANCELLED")
      throw badRequest("Cannot update a cancelled meeting");

    if (input.startTime && input.endTime) {
      const start = new Date(input.startTime);
      const end = new Date(input.endTime);
      if (end <= start) throw badRequest("End time must be after start time");
    }

    if (
      input.visibility === "PRIVATE" &&
      input.attendeeIds !== undefined &&
      input.attendeeIds.length === 0
    ) {
      throw badRequest("Private meetings require at least one attendee");
    }

    const meeting = await MeetingMutation.update({ meetingId, input });

    notifyMeetingUpdated({
      meeting,
      workspaceId: ctx.workspaceId,
      senderId: ctx.userId,
      senderName,
      isAdmin: isAdmin(ctx.workspaceRole),
    }).catch(console.error);

    return meeting;
  },

  async cancel(ctx: MeetingContext, meetingId: string, senderName: string) {
    const existing = await MeetingQuery.findById(meetingId);
    if (!existing) throw notFound("Meeting not found");
    if (existing.workspaceId !== ctx.workspaceId)
      throw forbidden("Meeting does not belong to this workspace");

    const canCancel =
      isAdmin(ctx.workspaceRole) || existing.createdById === ctx.userId;
    if (!canCancel) throw forbidden("You cannot cancel this meeting");

    if (existing.status === "CANCELLED")
      throw badRequest("Meeting is already cancelled");

    const meeting = await MeetingMutation.cancel(meetingId);

    notifyMeetingCancelled({
      meeting,
      workspaceId: ctx.workspaceId,
      senderId: ctx.userId,
      senderName,
    }).catch(console.error);

    return meeting;
  },

  async delete(ctx: MeetingContext, meetingId: string) {
    const existing = await MeetingQuery.findById(meetingId);
    if (!existing) throw notFound("Meeting not found");
    if (existing.workspaceId !== ctx.workspaceId)
      throw forbidden("Meeting does not belong to this workspace");

    if (!isAdmin(ctx.workspaceRole) && existing.createdById !== ctx.userId) {
      throw forbidden("You cannot delete this meeting");
    }

    await MeetingMutation.delete(meetingId);
  },
};
