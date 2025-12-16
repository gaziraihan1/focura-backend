// routes/notifications.routes.ts
import { Router } from "express";
import { notificationStream } from "../sockets/notification.stream.js";
import { NotificationController } from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/stream/:userId", notificationStream);

router.get("/", authenticate, NotificationController.getNotifications);
router.get("/unread-count", authenticate, NotificationController.getUnreadCount);

// Mark as read
router.patch("/:id/read", authenticate, NotificationController.markAsRead);
router.patch("/read-all", authenticate, NotificationController.markAllAsRead);

// Delete
router.delete("/:id", authenticate, NotificationController.deleteNotification);
router.delete("/read/all", authenticate, NotificationController.deleteAllRead);

export default router;