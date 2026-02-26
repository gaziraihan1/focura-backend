// backend/src/middleware/auth.ts
// STATUS: MODIFY — replaces your current auth middleware
// CHANGES: RS256 verification using public key only (no private key on backend),
//          token version check, token type check, optional Redis revocation check,
//          role-based authorize(), user-tier rate limiting middleware.

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { prisma } from "../index.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string | null;
    tokenJti?: string;
  };
}

// ─── Load Public Key ──────────────────────────────────────────────────────────
// The backend ONLY needs the public key — never load the private key here.

let publicKey: string;

try {
  if (process.env.JWT_PUBLIC_KEY) {
    // Production: base64-encoded env var
    publicKey = Buffer.from(process.env.JWT_PUBLIC_KEY, "base64").toString("utf-8");
  } else {
    // Development: PEM file path
    const keysDir = path.join(process.cwd(), "..", "keys");
    publicKey = fs.readFileSync(
      process.env.JWT_PUBLIC_KEY_PATH || path.join(keysDir, "public.pem"),
      "utf-8"
    );
  }
} catch (error) {
  console.error("❌  Failed to load JWT public key:", error);
  throw new Error("JWT public key not found. Copy keys/public.pem from frontend.");
}

// Must match CURRENT_TOKEN_VERSION in frontend/src/lib/auth/backendToken.ts
const CURRENT_TOKEN_VERSION = 1;

// ─── authenticate ─────────────────────────────────────────────────────────────

/**
 * Main auth middleware. Verifies the Bearer token, checks version/type,
 * optionally checks Redis revocation, then attaches user to req.user.
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "NO_TOKEN",
      });
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "NO_TOKEN",
      });
    }

    // 1. Cryptographic verification (RS256, issuer, audience)
    let decoded: any;
    try {
      decoded = jwt.verify(token, publicKey, {
        algorithms: ["RS256"],
        issuer: "focura-app",
        audience: "focura-backend",
      });
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Token expired. Please refresh your session.",
          code: "TOKEN_EXPIRED",
        });
      }
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        code: "INVALID_TOKEN",
      });
    }

    // 2. Token version check (allows global invalidation by incrementing CURRENT_TOKEN_VERSION)
    if (decoded.version !== CURRENT_TOKEN_VERSION) {
      return res.status(401).json({
        success: false,
        message: "Token version mismatch. Please log in again.",
        code: "TOKEN_VERSION_MISMATCH",
      });
    }

    // 3. Token type check — only access tokens are accepted here
    if (decoded.type !== "access") {
      return res.status(401).json({
        success: false,
        message: "Invalid token type",
        code: "INVALID_TOKEN_TYPE",
      });
    }

    // 4. Optional Redis revocation check (skipped gracefully if Redis not configured)
    if (decoded.jti && process.env.UPSTASH_REDIS_REST_URL) {
      const { isAccessTokenRevoked } = await import("../lib/auth/tokenRevocation.js");
      const isRevoked = await isAccessTokenRevoked(decoded.jti);
      if (isRevoked) {
        return res.status(401).json({
          success: false,
          message: "Token has been revoked",
          code: "TOKEN_REVOKED",
        });
      }
    }

    // 5. Database lookup — verify user still exists and email is verified
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, name: true, role: true, emailVerified: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email address",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    // Attach to request for downstream handlers
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tokenJti: decoded.jti,
    };

    next();
  } catch (err) {
    console.error("🔴  Authentication error:", err);
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      code: "AUTH_ERROR",
      ...(process.env.NODE_ENV === "development" && { error: (err as Error).message }),
    });
  }
};

// ─── authorize ────────────────────────────────────────────────────────────────

/**
 * Role-based authorization. Must be used after authenticate().
 *
 * @example
 *   router.delete('/user/:id', authenticate, authorize('ADMIN'), handler);
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        code: "NOT_AUTHENTICATED",
      });
    }

    if (!roles.includes(req.user.role)) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `⚠️  Access denied. Required: [${roles.join(", ")}], User has: ${req.user.role}`
        );
      }
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions",
        code: "FORBIDDEN",
      });
    }

    next();
  };
};

// ─── rateLimitByUser ──────────────────────────────────────────────────────────

/**
 * Per-user API rate limiter with subscription tier support.
 * Silently skips if Redis is not configured.
 *
 * @example
 *   router.post('/ai/generate', authenticate, rateLimitByUser('pro'), handler);
 */
export const rateLimitByUser = (tier?: "free" | "pro" | "enterprise") => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.id || !process.env.UPSTASH_REDIS_REST_URL) {
      return next();
    }

    try {
      const { limitApiRequest } = await import("../lib/limiter.js");
      const result = await limitApiRequest(req.user.id, tier || "free");

      res.setHeader("X-RateLimit-Limit", result.limit ?? 60);
      res.setHeader("X-RateLimit-Remaining", result.remaining ?? 0);
      if (result.reset) res.setHeader("X-RateLimit-Reset", result.reset.toString());

      if (!result.success) {
        const retryAfter = result.reset
          ? Math.ceil((result.reset - Date.now()) / 1000)
          : 60;

        return res.status(429).json({
          success: false,
          message: "Rate limit exceeded. Please try again later.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter,
        });
      }

      next();
    } catch (err) {
      console.error("Rate limit error:", err);
      next(); // Never block requests on limiter failure
    }
  };
};