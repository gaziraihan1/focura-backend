import { Redis } from "ioredis";

let client: Redis | null = null;

export function getRedisClient(): Redis {
  if (client) return client;

  client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => Math.min(times * 100, 3000),
    enableReadyCheck: true,
    lazyConnect: false,
    tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
  });

  client.on("error", (err: Error) => console.error("[Redis] error:", err));
  client.on("ready", () => console.log("[Redis] connected"));
  client.on("close", () => console.warn("[Redis] connection closed"));

  return client;
}

export const BILLING_CACHE = {
  subKey: (workspaceId: string) => `billing:sub:${workspaceId}`,
  limitsKey: (planName: string) => `billing:limits:${planName}`,
  invoiceKey: (workspaceId: string) => `billing:invoices:${workspaceId}`,
  userWsLimitKey: (userId: string) => `billing:user-ws-limit:${userId}`,

  SUB_TTL: 300,
  LIMITS_TTL: 3600,
  INVOICE_TTL: 120,
  USER_WS_LIMIT_TTL: 300,

  async getSubscription(workspaceId: string) {
    const redis = getRedisClient();
    const raw = await redis.get(BILLING_CACHE.subKey(workspaceId));
    return raw ? JSON.parse(raw) : null;
  },

  async setSubscription(workspaceId: string, data: unknown) {
    const redis = getRedisClient();
    await redis.setex(
      BILLING_CACHE.subKey(workspaceId),
      BILLING_CACHE.SUB_TTL,
      JSON.stringify(data),
    );
  },

  async getPlanLimits(planName: string) {
    const redis = getRedisClient();
    const raw = await redis.get(BILLING_CACHE.limitsKey(planName));
    return raw ? JSON.parse(raw) : null;
  },

  async setPlanLimits(planName: string, data: unknown) {
    const redis = getRedisClient();
    await redis.setex(
      BILLING_CACHE.limitsKey(planName),
      BILLING_CACHE.LIMITS_TTL,
      JSON.stringify(data),
    );
  },

  async invalidateWorkspace(workspaceId: string, ownerId?: string) {
    const redis = getRedisClient();
    const keys = [
      BILLING_CACHE.subKey(workspaceId),
      BILLING_CACHE.invoiceKey(workspaceId),
    ];
    if (ownerId) keys.push(BILLING_CACHE.userWsLimitKey(ownerId));
    await redis.del(...keys);
  },

  async getUserWsLimit(userId: string): Promise<number | null> {
    const redis = getRedisClient();
    const raw = await redis.get(BILLING_CACHE.userWsLimitKey(userId));
    return raw !== null ? JSON.parse(raw) : null;
  },

  async setUserWsLimit(userId: string, limit: number) {
    const redis = getRedisClient();
    await redis.setex(
      BILLING_CACHE.userWsLimitKey(userId),
      BILLING_CACHE.USER_WS_LIMIT_TTL,
      JSON.stringify(limit),
    );
  },
};
