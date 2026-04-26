import { Request, Response, NextFunction } from "express";
import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "../../lib/redis.js"; // ← your existing shared Redis client

// ─── Rate limiters ────────────────────────────────────────────────────────────
/**
 * Per-IP: 3 contact form submissions per hour (sliding window)
 * Prevents spam from a single IP without blocking legitimate retries.
 */
const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "1 h"),
  prefix: "focura:contact:ip",
  analytics: true,
});

/**
 * Per-email: 2 submissions per 24 hours (sliding window)
 * Prevents the same user from spamming even if they change IPs.
 */
const emailLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(2, "24 h"),
  prefix: "focura:contact:email",
  analytics: true,
});

// ─── Helper: extract real IP ─────────────────────────────────────────────────
function getRealIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

// ─── Middleware ───────────────────────────────────────────────────────────────
/**
 * contactRateLimit
 *
 * Applies two rate-limit checks:
 *   1. IP-based  — 3 requests / hour
 *   2. Email-based — 2 requests / 24 h  (only if body.email is present)
 *
 * On limit exceeded, returns 429 with reset timestamps so the client
 * can display a meaningful "try again in X minutes" message.
 */
export async function contactRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ip = getRealIp(req);

  // ── 1. IP check ──────────────────────────────────────────────────────────
  const ipResult = await ipLimiter.limit(ip);

  if (!ipResult.success) {
    const resetInMs = ipResult.reset - Date.now();
    const resetInMinutes = Math.ceil(resetInMs / 60_000);

    res.status(429).json({
      success: false,
      error: "TOO_MANY_REQUESTS",
      message: `You have sent too many messages. Please try again in ${resetInMinutes} minute${resetInMinutes !== 1 ? "s" : ""}.`,
      retryAfter: ipResult.reset,
      remaining: ipResult.remaining,
    });
    return;
  }

  // ── 2. Email check (only if email present in body) ────────────────────────
  const email: string | undefined = req.body?.email?.toLowerCase?.().trim();

  if (email) {
    const emailResult = await emailLimiter.limit(email);

    if (!emailResult.success) {
      const resetInMs = emailResult.reset - Date.now();
      const resetInHours = Math.ceil(resetInMs / 3_600_000);

      res.status(429).json({
        success: false,
        error: "TOO_MANY_REQUESTS",
        message: `This email has already sent the maximum number of messages today. Please try again in ${resetInHours} hour${resetInHours !== 1 ? "s" : ""}.`,
        retryAfter: emailResult.reset,
        remaining: emailResult.remaining,
      });
      return;
    }
  }

  // Attach rate-limit metadata to request for controller use
  res.setHeader("X-RateLimit-Limit", "3");
  res.setHeader("X-RateLimit-Remaining", String(ipResult.remaining));
  res.setHeader("X-RateLimit-Reset", String(ipResult.reset));

  next();
}