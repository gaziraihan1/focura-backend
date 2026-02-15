// routes/focus-session.routes.ts

import { Router } from 'express';
import { FocusSessionController } from '../controllers/focusSession.controller.js';

const router = Router();


// Start a focus session
router.post('/start', FocusSessionController.startSession);

// Complete a focus session
router.post('/:id/complete', FocusSessionController.completeSession);

// Cancel a focus session
router.post('/:id/cancel', FocusSessionController.cancelSession);

// Get active session
router.get('/active', FocusSessionController.getActiveSession);

// Get session history
router.get('/history', FocusSessionController.getHistory);

export default router;