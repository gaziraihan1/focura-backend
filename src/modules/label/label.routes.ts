/**
 * label.routes.ts
 * Responsibility: Route definitions for the Label domain.
 *
 * Route order is already correct in the original:
 *  /popular declared before /:id so "popular" isn't caught as a param.
 */

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

// ─── Label CRUD ───────────────────────────────────────────────────────────────
router.get('/',         getLabels);
router.get('/popular',  getPopularLabels);   // must be before /:id
router.get('/:id',      getLabelById);
router.post('/',        createLabel);
router.patch('/:id',    updateLabel);
router.delete('/:id',   deleteLabel);

// ─── Task ↔ label association ─────────────────────────────────────────────────
router.post('/:labelId/tasks/:taskId',   addLabelToTask);
router.delete('/:labelId/tasks/:taskId', removeLabelFromTask);

export default router;