import { Router } from 'express';
import {
  getSubtasks,
  getSubtaskStats,
  getSubtask,
  createSubtask,
  updateSubtask,
  updateSubtaskStatus,
  deleteSubtask,
} from './subtask.controller.js';

// Mounted at /:taskId/subtasks via task.routes.ts
const router = Router({ mergeParams: true });

router.get('/',                          getSubtasks);
router.get('/stats',                     getSubtaskStats);
router.post('/',                         createSubtask);
router.get('/:subtaskId',                getSubtask);
router.put('/:subtaskId',                updateSubtask);
router.patch('/:subtaskId/status',       updateSubtaskStatus);
router.delete('/:subtaskId',             deleteSubtask);

export { router as subtaskRouter };