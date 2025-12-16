// sockets/notification.stream.ts
import { Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

const clients = new Map<string, Response>();

export function notificationStream(req: Request, res: Response) {
  console.log("\n=== NEW SSE CONNECTION ATTEMPT ===");
  console.log("Timestamp:", new Date().toISOString());
  
  const userId = req.params.userId;
  let token = req.query.token as string;

  console.log("User ID from URL:", userId);
  console.log("Token received:", !!token);
  console.log("Token length:", token?.length);
  console.log("Request URL:", req.url);
  console.log("Request method:", req.method);

  // Validate userId
  if (!userId) {
    console.error("❌ Missing userId parameter");
    return res.status(400).json({
      success: false,
      message: "User ID is required",
    });
  }

  // Validate token presence
  if (!token) {
    console.error("❌ Missing token in query parameters");
    console.log("Available query params:", Object.keys(req.query));
    return res.status(401).json({
      success: false,
      message: "Missing authentication token",
    });
  }

  // Trim whitespace
  token = token.trim();
  console.log("Token after trim - length:", token.length);

  // Check JWT secret
  if (!process.env.BACKEND_JWT_SECRET) {
    console.error("❌ CRITICAL: BACKEND_JWT_SECRET environment variable not set!");
    return res.status(500).json({
      success: false,
      message: "Server configuration error",
    });
  }

  console.log("✅ JWT Secret is configured");
  console.log("JWT Secret length:", process.env.BACKEND_JWT_SECRET.length);

  // Verify JWT token
  try {
    console.log("🔍 Starting token verification...");
    
    const decoded = jwt.verify(token, process.env.BACKEND_JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "focura-app",
      audience: "focura-backend",
    }) as JwtPayload;

    console.log("✅ Token verified successfully!");
    console.log("Token payload:", {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      iat: decoded.iat,
      exp: decoded.exp,
      issued: new Date((decoded.iat || 0) * 1000).toISOString(),
      expires: new Date((decoded.exp || 0) * 1000).toISOString(),
    });

    const decodedUserId = decoded.sub;

    // Check if token has sub claim
    if (!decodedUserId) {
      console.error("❌ Token missing 'sub' claim");
      return res.status(401).json({
        success: false,
        message: "Invalid token payload - missing subject",
      });
    }

    // Verify userId matches token
    if (decodedUserId !== userId) {
      console.error("❌ User ID mismatch!");
      console.error("  Token userId:", decodedUserId);
      console.error("  URL userId:", userId);
      return res.status(403).json({
        success: false,
        message: "Token does not match requested user ID",
      });
    }

    console.log("✅ User ID matches token - authorization successful");

  } catch (error) {
    console.error("\n❌ TOKEN VERIFICATION FAILED");
    console.error("Error type:", error?.constructor?.name);
    console.error("Error message:", (error as Error)?.message);

    if (error instanceof jwt.TokenExpiredError) {
      console.error("Token expired at:", error.expiredAt);
      console.error("Current time:", new Date().toISOString());
      return res.status(401).json({
        success: false,
        message: "Token has expired. Please login again.",
        code: "TOKEN_EXPIRED",
        expiredAt: error.expiredAt,
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      console.error("JWT validation error:", error.message);
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        code: "INVALID_TOKEN",
        details: process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    console.error("Unexpected error during verification:", error);
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: process.env.NODE_ENV === "development" ? (error as Error).message : undefined,
    });
  }

  console.log("\n🔄 Setting up SSE connection...");

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable NGINX buffering

  // CORS headers for development
  if (process.env.NODE_ENV === "development") {
    const origin = req.headers.origin || "http://localhost:3000";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  console.log("✅ SSE headers set");

  // Send initial connection confirmation
  const connectionMessage = {
    connected: true,
    type: "connected",
    message: "SSE connection established successfully",
    userId: userId,
    timestamp: new Date().toISOString(),
  };

  res.write(`data: ${JSON.stringify(connectionMessage)}\n\n`);
  console.log("✅ Connection confirmation sent");

  // Store the client connection
  clients.set(userId, res);
  console.log(`✅ Client stored - User: ${userId}`);
  console.log(`📊 Total active connections: ${clients.size}`);
  console.log(`👥 Connected users: ${Array.from(clients.keys()).join(", ")}`);

  // Keep-alive heartbeat (every 30 seconds)
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch (err) {
      console.error(`❌ Heartbeat failed for user ${userId}:`, err);
      clearInterval(heartbeat);
      clients.delete(userId);
    }
  }, 30000);

  console.log("✅ Heartbeat started");

  // Handle client disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(userId);
    console.log(`\n🔴 SSE DISCONNECTED - User: ${userId}`);
    console.log(`📊 Remaining connections: ${clients.size}`);
  });

  req.on("error", (error) => {
    console.error(`\n❌ SSE CONNECTION ERROR - User: ${userId}`);
    console.error("Error:", error);
    clearInterval(heartbeat);
    clients.delete(userId);
  });

  console.log("=== SSE CONNECTION SETUP COMPLETE ===\n");
}

/**
 * Send a notification to a specific user via SSE
 */
export function sendNotificationToUser(userId: string, notification: any): boolean {
  const client = clients.get(userId);

  if (!client) {
    console.log(`⚠️ No active SSE connection for user ${userId}`);
    console.log(`📊 Active connections: ${clients.size}`);
    console.log(`👥 Connected users: ${Array.from(clients.keys()).join(", ")}`);
    return false;
  }

  try {
    const data = JSON.stringify(notification);
    client.write(`data: ${data}\n\n`);
    console.log(`📤 Notification sent to user ${userId}`);
    console.log(`   Title: ${notification.title || "N/A"}`);
    console.log(`   Type: ${notification.type || "N/A"}`);
    return true;
  } catch (err) {
    console.error(`❌ Failed to send notification to user ${userId}:`, err);
    clients.delete(userId);
    return false;
  }
}

/**
 * Get the number of active SSE connections
 */
export function getActiveConnections(): number {
  return clients.size;
}

/**
 * Get list of currently connected user IDs
 */
export function getConnectedUsers(): string[] {
  return Array.from(clients.keys());
}


export function broadcastNotification(notification: any): void {
  console.log(`📢 Broadcasting notification to ${clients.size} users`);
  
  for (const [userId, client] of clients.entries()) {
    try {
      client.write(`data: ${JSON.stringify(notification)}\n\n`);
    } catch (err) {
      console.error(`❌ Failed to broadcast to user ${userId}:`, err);
      clients.delete(userId);
    }
  }
}