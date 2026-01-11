import { Router } from 'express';
import {
  getLabels,
  getLabelById,
  createLabel,
  updateLabel,
  deleteLabel,
  addLabelToTask,
  removeLabelFromTask,
  getPopularLabels,
} from '../controllers/label.controller.js';

const router = Router();

// Label CRUD
router.get('/', getLabels);
router.get('/popular', getPopularLabels);
router.get('/:id', getLabelById);
router.post('/', createLabel);
router.patch('/:id', updateLabel);
router.delete('/:id', deleteLabel);

// Task label management
router.post('/:labelId/tasks/:taskId', addLabelToTask);
router.delete('/:labelId/tasks/:taskId', removeLabelFromTask);

export default router;
