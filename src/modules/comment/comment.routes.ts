/**
 * comment.routes.ts
 * Responsibility: Route definitions for the Comment domain.
 *
 * Note: This router uses { mergeParams: true } because it's mounted
 * as a nested router under /tasks/:taskId/comments.
 */

import { Router } from 'express';
import {
  getComments,
  addComment,
  updateComment,
  deleteComment,
} from './comment.controller.js';

const router = Router({ mergeParams: true });

router.get('/',              getComments);
router.post('/',             addComment);
router.put('/:commentId',    updateComment);
router.delete('/:commentId', deleteComment);

export default router;