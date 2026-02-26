// backend/src/sockets/notification.stream.ts
// STATUS: MODIFY
// CHANGES:
//   - Removed ALL authentication from the SSE stream (as requested)
//   - Kept userId param for routing notifications to the right client
//   - Kept audit logging for connection tracking

import { Request, Response } from "express";
import { auditLog } from "../lib/auth/auditLog.js";

const clients = new Map<string, Response>();
const getIp = (req: Request) =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
  req.socket.remoteAddress ||
  "unknown";

export async function notificationStream(req: Request, res: Response) {
  const userId = req.params.userId;
  const ip     = getIp(req);

  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required" });
  }

  // ─── SSE Setup ──────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (process.env.NODE_ENV === "development") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "http://localhost:3000");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  // Send initial confirmation
  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      userId,
      timestamp: new Date().toISOString(),
    })}\n\n`
  );

  clients.set(userId, res);
  auditLog("SSE_CONNECTED", { userId, ip });

  // Heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      clients.delete(userId);
    }
  }, 30_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(userId);
    auditLog("SSE_DISCONNECTED", { userId, ip });
  });

  req.on("error", () => {
    clearInterval(heartbeat);
    clients.delete(userId);
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function sendNotificationToUser(userId: string, notification: any): boolean {
  const client = clients.get(userId);
  if (!client) return false;
  try {
    client.write(`data: ${JSON.stringify(notification)}\n\n`);
    return true;
  } catch {
    clients.delete(userId);
    return false;
  }
}

export function broadcastNotification(notification: any): void {
  for (const [userId, client] of clients.entries()) {
    try {
      client.write(`data: ${JSON.stringify(notification)}\n\n`);
    } catch {
      clients.delete(userId);
    }
  }
}

export const getActiveConnections = () => clients.size;
export const getConnectedUsers    = () => Array.from(clients.keys());