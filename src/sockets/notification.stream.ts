// sockets/notification.stream.ts
import { Request, Response } from "express";
import jwt from "jsonwebtoken";

const clients = new Map<string, Response>();

export function notificationStream(req: Request, res: Response) {
  const userId = req.params.userId;
  const token = req.query.token as string;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Missing token",
    });
  }

  // 🔐 Validate Token
  try {
    const decoded = jwt.verify(token, process.env.BACKEND_JWT_SECRET!);

    const decodedUserId = (decoded as any).sub;

if (!decodedUserId || decodedUserId !== userId) {
  return res.status(403).json({ success: false, message: "Invalid token for this user" });
}

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  // SSE headers (no cookies needed)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable buffering (NGINX)

  // Send initial connection message
  res.write(
    `data: ${JSON.stringify({
      type: "connected",
      message: "SSE connected",
    })}\n\n`
  );

  // Store connection
  clients.set(userId, res);
  console.log(
    `✅ SSE: User ${userId} connected. Total connections: ${clients.size}`
  );

  // Keep-alive ping
  const heartbeat = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 30000);

  // Handle disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(userId);
    console.log(
      `❌ SSE: User ${userId} disconnected. Total connections: ${clients.size}`
    );
  });
}

// Send notification to single user
export function sendNotificationToUser(userId: string, notification: any) {
  const client = clients.get(userId);

  if (!client) {
    console.log(`⚠️ No active SSE connection for user ${userId}`);
    return false;
  }

  try {
    client.write(`data: ${JSON.stringify(notification)}\n\n`);
    console.log(`📤 Sent notification → user ${userId}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send SSE to user ${userId}:`, err);
    clients.delete(userId);
    return false;
  }
}

export function getActiveConnections() {
  return clients.size;
}

export function getConnectedUsers() {
  return Array.from(clients.keys());
}
