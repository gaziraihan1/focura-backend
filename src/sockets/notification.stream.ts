// sockets/notification.stream.ts
import { Request, Response } from "express";

const clients = new Map<string, Response>();

export function notificationStream(req: Request, res: Response) {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  // SSE Headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", process.env.FRONTEND_URL || "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  
  // Disable compression for SSE
  res.setHeader("X-Accel-Buffering", "no");

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: "connected", message: "SSE connected" })}\n\n`);

  // Store client connection
  clients.set(userId, res);
  console.log(`✅ SSE: User ${userId} connected. Total connections: ${clients.size}`);

  // Heartbeat to keep connection alive (every 30 seconds)
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat\n\n`);
  }, 30000);

  // Handle client disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(userId);
    console.log(`❌ SSE: User ${userId} disconnected. Total connections: ${clients.size}`);
  });
}

export function sendNotificationToUser(userId: string, notification: any) {
  const client = clients.get(userId);
  
  if (!client) {
    console.log(`⚠️ SSE: No active connection for user ${userId}`);
    return false;
  }

  try {
    client.write(`data: ${JSON.stringify(notification)}\n\n`);
    console.log(`📤 SSE: Sent notification to user ${userId}`);
    return true;
  } catch (error) {
    console.error(`❌ SSE: Failed to send to user ${userId}:`, error);
    clients.delete(userId);
    return false;
  }
}

// Get active connections count
export function getActiveConnections(): number {
  return clients.size;
}

// Get all connected user IDs
export function getConnectedUsers(): string[] {
  return Array.from(clients.keys());
}