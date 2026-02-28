
import { Router } from 'express';
import {
  getLabels,
  getPopularLabels,
  getLabelById,
  createLabel,
  updateLabel,
  deleteLabel,
  addLabelToTask,
  removeLabelFromTask,
} from './label.controller.js';

const router = Router();

router.get('/',         getLabels);
router.get('/popular',  getPopularLabels);
router.get('/:id',      getLabelById);
router.post('/',        createLabel);
router.patch('/:id',    updateLabel);
router.delete('/:id',   deleteLabel);

router.post('/:labelId/tasks/:taskId',   addLabelToTask);
router.delete('/:labelId/tasks/:taskId', removeLabelFromTask);

export default router;