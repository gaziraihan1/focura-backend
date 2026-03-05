import { Router } from 'express';
import { upload } from '../../middleware/upload.js';
import {
  getTasks,
  getTaskStats,
  createTask,
  getTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getPersonalQuota,
  getWorkspaceQuota,
} from './task.controller.js';
import commentRoutes from '../comment/comment.routes.js';

import {
  getTaskAttachments,
  addAttachment,
  deleteAttachment,
} from '../attachment/index.js';

const router = Router();

router.get('/quota/personal',                  getPersonalQuota);
router.get('/quota/workspace/:workspaceId',    getWorkspaceQuota);

router.get('/stats', getTaskStats);

router.get('/',      getTasks);
router.post('/',     createTask);
router.get('/:id',   getTask);
router.put('/:id',   updateTask);
router.patch('/:id/status', updateTaskStatus);
router.delete('/:id', deleteTask);

router.use('/:taskId/comments', commentRoutes);

router.get('/:taskId/attachments',                          getTaskAttachments);
router.post('/:taskId/attachments', upload.single('file'),  addAttachment);
router.delete('/:taskId/attachments/:attachmentId',         deleteAttachment);

export default router;