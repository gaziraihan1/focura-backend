// src/modules/notification/notification.routes.ts

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { notificationStream } from '../../sockets/notification.stream.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
} from './notification.controller.js';

const router = Router();

// SSE stream (no auth - handled in stream itself)
router.get('/stream/:userId', notificationStream);

// All authenticated routes
router.use(authenticate); // ← ADD THIS LINE

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);
router.delete('/:id', deleteNotification);
router.delete('/read/all', deleteAllRead);

export default router;