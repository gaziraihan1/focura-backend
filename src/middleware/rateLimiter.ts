import { Redis } from "@upstash/redis";
import { Request, Response, NextFunction } from "express";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const rateLimitMiddleware = (
  max: number = 100,
  windowSeconds: number = 60
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const key = `rl:backend:${ip}`;

    try {
      const now = Date.now();
      const windowStart = now - (windowSeconds * 1000);

      await redis.zremrangebyscore(key, 0, windowStart);
      const count = await redis.zcard(key);

      if (count >= max) {
        return res.status(429).json({
          error: "Too many requests",
          retryAfter: windowSeconds,
        });
      }

      await redis.zadd(key, { score: now, member: `${now}:${Math.random()}` });
      await redis.expire(key, windowSeconds);

      next();
    } catch (error) {
      console.error("Rate limit error:", error);
      next();
    }
  };
};