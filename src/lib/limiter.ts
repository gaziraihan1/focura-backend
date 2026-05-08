import { Redis } from "@upstash/redis";
import { redis } from "./redis.js";

export interface RateLimitResult {
  success: boolean;
  reset?: number;
  remaining?: number;
  limit?: number;
}

const USER_TIER_LIMITS = { free: 60, pro: 300, enterprise: 1000 } as const;

class RedisRateLimiter {
  private redis: Redis;
  constructor() {
    this.redis = redis
  }
  async limit(key: string, customLimit = 60): Promise<RateLimitResult> {
    const now = Date.now(),
      window = 60_000,
      windowStart = now - window,
      limitKey = `focura:rl:${key}`;
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(limitKey, 0, windowStart);
    pipeline.zcard(limitKey);
    pipeline.zadd(limitKey, { score: now, member: `${now}:${Math.random()}` });
    pipeline.expire(limitKey, 60);
    const results = await pipeline.exec();
    const count = (results[1] as number) || 0;
    return {
      success: count < customLimit,
      remaining: Math.max(0, customLimit - count - 1),
      reset: now + window,
      limit: customLimit,
    };
  }
}

class DevRateLimiter {
  private store = new Map<string, number[]>();
  async limit(key: string, customLimit = 60): Promise<RateLimitResult> {
    const now = Date.now(),
      windowStart = now - 60_000;
    const timestamps = (this.store.get(key) ?? []).filter(
      (ts) => ts > windowStart,
    );
    const count = timestamps.length,
      success = count < customLimit;
    if (success) timestamps.push(now);
    this.store.set(key, timestamps);
    return {
      success,
      remaining: Math.max(0, customLimit - count - 1),
      reset: now + 60_000,
      limit: customLimit,
    };
  }
}

const limiterInstance =
  process.env.NODE_ENV === "production" && process.env.UPSTASH_REDIS_REST_URL
    ? new RedisRateLimiter()
    : new DevRateLimiter();

export async function limitApiRequest(
  userId: string,
  userTier: keyof typeof USER_TIER_LIMITS = "free",
): Promise<RateLimitResult> {
  return limiterInstance.limit(`user:${userId}`, USER_TIER_LIMITS[userTier]);
}
