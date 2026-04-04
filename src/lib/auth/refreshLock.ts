import { redis } from "../redis.js";

const REFRESH_LOCK_TTL_SECONDS = 45;

export async function acquireRefreshLock(sessionId: string): Promise<boolean> {
  if (!redis) return true; // dev bypass
  // NX: set only if not exists
  return !!(await redis.set(`focura:refresh:lock:${sessionId}`, "1", {
    nx: true,
    ex: REFRESH_LOCK_TTL_SECONDS,
  }));
}

export async function releaseRefreshLock(sessionId: string): Promise<void> {
  await redis?.del(`focura:refresh:lock:${sessionId}`);
}

export async function isRefreshLocked(sessionId: string): Promise<boolean> {
  if (!redis) return false;
  const lock = await redis.get(`focura:refresh:lock:${sessionId}`);
  return !!lock;
}
