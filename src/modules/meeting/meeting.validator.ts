import { z } from "zod";

export const createMeetingSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  link: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  location: z.string().max(300).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  startTime: z.string().datetime({ message: "Invalid start time" }),
  endTime: z.string().datetime({ message: "Invalid end time" }),
  attendeeIds: z.array(z.string().cuid()).optional(),
});

export const updateMeetingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  link: z.string().url().optional().nullable().or(z.literal("")),
  location: z.string().max(300).optional().nullable(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  status: z.enum(["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  attendeeIds: z.array(z.string().cuid()).optional(),
});

export const listMeetingsSchema = z.object({
  status: z.enum(["SCHEDULED", "ONGOING", "COMPLETED", "CANCELLED"]).optional(),
  upcoming: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(50))
    .optional(),
});
