// backend/src/lib/auth/accountLockout.ts
// STATUS: CREATE — hard account lockout after N failed login attempts.
// Rate limiting slows attackers. Lockout STOPS them completely.

import { Redis } from "@upstash/redis";

const redis: Redis | null =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const devFailures = new Map<string, { count: number; lockedUntil?: number }>();

const MAX_FAILURES    = 10;           // lock after 10 bad attempts
const LOCKOUT_SECONDS = 15 * 60;      // 15 minute lockout
const WINDOW_SECONDS  = 60 * 60;      // failure counter resets after 1 hour
const PREFIX          = "focura:lockout";

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Call on every failed login attempt.
 * Returns { locked: true, unlocksAt } if account is now locked.
 */
export async function recordFailedAttempt(
  identifier: string // email or userId
): Promise<{ locked: boolean; unlocksAt?: Date; attempts: number }> {
  if (redis) {
    return recordFailedRedis(identifier);
  }
  return recordFailedDev(identifier);
}

/**
 * Call on successful login to clear the failure counter.
 */
export async function clearFailedAttempts(identifier: string): Promise<void> {
  if (redis) {
    await redis.del(`${PREFIX}:failures:${identifier}`);
    await redis.del(`${PREFIX}:locked:${identifier}`);
  } else {
    devFailures.delete(identifier);
  }
}

/**
 * Check if an account is currently locked before processing login.
 */
export async function isAccountLocked(
  identifier: string
): Promise<{ locked: boolean; unlocksAt?: Date }> {
  if (redis) {
    const lockedUntil = await redis.get<number>(`${PREFIX}:locked:${identifier}`);
    if (!lockedUntil) return { locked: false };
    return { locked: true, unlocksAt: new Date(lockedUntil) };
  }

  const entry = devFailures.get(identifier);
  if (!entry?.lockedUntil) return { locked: false };
  if (Date.now() > entry.lockedUntil) {
    devFailures.delete(identifier);
    return { locked: false };
  }
  return { locked: true, unlocksAt: new Date(entry.lockedUntil) };
}

// ─── Redis Implementation ─────────────────────────────────────────────────────

async function recordFailedRedis(
  identifier: string
): Promise<{ locked: boolean; unlocksAt?: Date; attempts: number }> {
  const failKey  = `${PREFIX}:failures:${identifier}`;
  const lockKey  = `${PREFIX}:locked:${identifier}`;

  // Check if already locked
  const existingLock = await redis!.get<number>(lockKey);
  if (existingLock) {
    return { locked: true, unlocksAt: new Date(existingLock), attempts: MAX_FAILURES };
  }

  // Increment failure counter
  const pipeline = redis!.pipeline();
  pipeline.incr(failKey);
  pipeline.expire(failKey, WINDOW_SECONDS);
  const results = await pipeline.exec();
  const attempts = (results[0] as number) || 1;

  if (attempts >= MAX_FAILURES) {
    const unlocksAt = Date.now() + LOCKOUT_SECONDS * 1000;
    await redis!.setex(lockKey, LOCKOUT_SECONDS, unlocksAt);
    return { locked: true, unlocksAt: new Date(unlocksAt), attempts };
  }

  return { locked: false, attempts };
}

// ─── In-memory Dev Implementation ────────────────────────────────────────────

function recordFailedDev(
  identifier: string
): { locked: boolean; unlocksAt?: Date; attempts: number } {
  const now   = Date.now();
  const entry = devFailures.get(identifier) || { count: 0 };

  // Clear expired lockout
  if (entry.lockedUntil && now > entry.lockedUntil) {
    devFailures.delete(identifier);
    return { locked: false, attempts: 0 };
  }

  entry.count++;
  devFailures.set(identifier, entry);

  if (entry.count >= MAX_FAILURES) {
    const unlocksAt = now + LOCKOUT_SECONDS * 1000;
    entry.lockedUntil = unlocksAt;
    return { locked: true, unlocksAt: new Date(unlocksAt), attempts: entry.count };
  }

  return { locked: false, attempts: entry.count };
}