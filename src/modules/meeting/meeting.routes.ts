import { Router } from "express";
import { MeetingController } from "./meeting.controller.js";
import { requireMeetingSlot } from "../billing/index.js";

const router = Router();

router.get("/:workspaceId/meetings", MeetingController.list);
router.get("/:workspaceId/meetings/:meetingId", MeetingController.getById);
router.post("/:workspaceId/meetings", requireMeetingSlot, MeetingController.create);
router.patch("/:workspaceId/meetings/:meetingId", MeetingController.update);
router.post("/:workspaceId/meetings/:meetingId/cancel", MeetingController.cancel);
router.delete("/:workspaceId/meetings/:meetingId", MeetingController.delete);

export default router;