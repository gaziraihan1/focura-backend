
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { verifyToken } from "../lib/auth/backendToken.js";
import { auditLog } from "../lib/auth/auditLog.js";

const clients = new Map<string, Response>();

const getIp = (req: Request) =>
  (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
  req.socket.remoteAddress ||
  "unknown";

export async function notificationStream(req: Request, res: Response) {
  const ip    = getIp(req);
  const token = (req.query.token as string)?.trim();

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token required",
      code:    "NO_TOKEN",
    });
  }

  let userId: string;

  try {
    const decoded = verifyToken(token, "access");
    userId = decoded.id;
  } catch (err: any) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: "Token expired",
        code:    "TOKEN_EXPIRED",
      });
    }
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      code:    "INVALID_TOKEN",
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (process.env.NODE_ENV === "development") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "http://localhost:3000");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);

  clients.set(userId, res);
  auditLog("SSE_CONNECTED", { userId, ip });

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