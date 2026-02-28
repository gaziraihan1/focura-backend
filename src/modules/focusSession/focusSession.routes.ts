
import { Router } from 'express';
import {
  startSession,
  completeSession,
  cancelSession,
  getActiveSession,
  getHistory,
  getStats,
} from './focusSession.controller.js';

const router = Router();

router.post('/start',   startSession);
router.get('/active',   getActiveSession);
router.get('/history',  getHistory);
router.get('/stats',    getStats);

router.post('/:id/complete', completeSession);
router.post('/:id/cancel',   cancelSession);

export default router;