/**
 * attachment/index.ts
 */

export { AttachmentQuery } from './attachment.query.js';
export { AttachmentMutation } from './attachment.mutation.js';
export { AttachmentAccess } from './attachment.access.js';
export { AttachmentValidation } from './attachment.validation.js';

// Export controllers (used by task.routes.ts and workspace.routes.ts)
export {
  getTaskAttachments,
  addAttachment,
  deleteAttachment,
  getAttachmentStats,
} from './attachment.controller.js';

export type * from './attachment.types.js';