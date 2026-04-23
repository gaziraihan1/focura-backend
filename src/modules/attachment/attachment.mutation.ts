import type { AddAttachmentInput } from "./attachment.types.js";
import { AttachmentService } from "./attachment.service.js";

export const AttachmentMutation = {
  addAttachment(input: AddAttachmentInput) {
    return AttachmentService.addAttachment(input);
  },

  deleteAttachment(fileId: string, userId: string) {
    return AttachmentService.deleteAttachment(fileId, userId);
  },
};