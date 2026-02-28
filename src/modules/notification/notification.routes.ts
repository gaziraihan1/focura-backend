
import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { notificationStream } from "../../sockets/notification.stream.js";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllRead,
} from "./notification.controller.js";

const router = Router();

router.get("/stream", notificationStream);

router.use(authenticate);

router.get("/", getNotifications);
router.get("/unread-count", getUnreadCount);
router.patch("/:id/read", markAsRead);
router.patch("/read-all", markAllAsRead);
router.delete("/read/all", deleteAllRead);
router.delete("/:id", deleteNotification);

export default router;