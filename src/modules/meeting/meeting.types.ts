import type { MeetingVisibility, MeetingStatus, WorkspaceRole } from '@prisma/client';


export interface CreateMeetingInput {
  title: string;
  description?: string;
  link?: string;
  location?: string;
  visibility: MeetingVisibility;
  startTime: string;
  endTime: string;
  attendeeIds?: string[];
}

export interface UpdateMeetingInput {
  title?: string;
  description?: string | null;
  link?: string | null;
  location?: string | null;
  visibility?: MeetingVisibility;
  status?: MeetingStatus;
  startTime?: string;
  endTime?: string;
  attendeeIds?: string[];
}

export interface ListMeetingsQuery {
  workspaceId: string;
  status?: MeetingStatus;
  upcoming?: boolean;
  cursor?: string;
  limit?: number;
}


export interface MeetingContext {
  userId: string;
  workspaceId: string;
  workspaceRole: WorkspaceRole | null;
}