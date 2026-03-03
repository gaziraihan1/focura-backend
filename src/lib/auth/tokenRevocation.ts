import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const devRevokedAccess = new Set<string>();
const devRefreshTokens = new Map<string, string>();
const devSseTokens = new Map<string, string>();

export async function revokeAccessToken(
  jti: string,
  expiresInSeconds: number,
): Promise<void> {
  if (redis)
    await redis.setex(`focura:revoked:access:${jti}`, expiresInSeconds, "1");
  else {
    devRevokedAccess.add(jti);
    setTimeout(() => devRevokedAccess.delete(jti), expiresInSeconds * 1000);
  }
}
export async function isAccessTokenRevoked(jti: string): Promise<boolean> {
  if (redis) return (await redis.get(`focura:revoked:access:${jti}`)) === "1";
  return devRevokedAccess.has(jti);
}

export async function storeRefreshToken(
  userId: string,
  jti: string,
  expiresInSeconds: number,
): Promise<void> {
  if (redis)
    await redis.setex(
      `focura:refresh:${userId}:${jti}`,
      expiresInSeconds,
      JSON.stringify({ jti, createdAt: Date.now() }),
    );
  else {
    devRefreshTokens.set(userId, jti);
    setTimeout(() => devRefreshTokens.delete(userId), expiresInSeconds * 1000);
  }
}
export async function isRefreshTokenValid(
  userId: string,
  jti: string,
): Promise<boolean> {
  if (redis)
    return (await redis.get(`focura:refresh:${userId}:${jti}`)) !== null;
  return devRefreshTokens.get(userId) === jti;
}
export async function revokeRefreshToken(
  userId: string,
  jti: string,
): Promise<void> {
  if (redis) await redis.del(`focura:refresh:${userId}:${jti}`);
  else if (devRefreshTokens.get(userId) === jti)
    devRefreshTokens.delete(userId);
}
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  if (redis) {
    const keys = await redis.keys(`focura:refresh:${userId}:*`);
    if (keys.length > 0) await redis.del(...keys);
  } else devRefreshTokens.delete(userId);
}
export async function rotateRefreshToken(
  userId: string,
  oldJti: string,
  newJti: string,
  expiresInSeconds: number,
): Promise<boolean> {
  if (!redis) {
    // dev fallback (single process safe)
    if (devRefreshTokens.get(userId) !== oldJti) return false;
    devRefreshTokens.set(userId, newJti);
    setTimeout(() => devRefreshTokens.delete(userId), expiresInSeconds * 1000);
    return true;
  }

  const oldKey = `focura:refresh:${userId}:${oldJti}`;
  const newKey = `focura:refresh:${userId}:${newJti}`;

  const result = await redis.eval(
    `
    if redis.call("EXISTS", KEYS[1]) == 1 then
      redis.call("DEL", KEYS[1])
      redis.call("SETEX", KEYS[2], ARGV[1], ARGV[2])
      return 1
    else
      return 0
    end
    `,
    [oldKey, newKey],
    [
      expiresInSeconds.toString(),
      JSON.stringify({ jti: newJti, createdAt: Date.now() }),
    ],
  );

  return result === 1;
}
export async function storeSseToken(
  jti: string,
  userId: string,
): Promise<void> {
  if (redis) await redis.setex(`focura:sse:${jti}`, 30, userId);
  else {
    devSseTokens.set(jti, userId);
    setTimeout(() => devSseTokens.delete(jti), 30_000);
  }
}
export async function consumeSseToken(jti: string): Promise<string | null> {
  if (redis) {
    const key = `focura:sse:${jti}`;
    const userId = await redis.get<string>(key);
    if (!userId) return null;
    await redis.del(key);
    return userId;
  }
  const userId = devSseTokens.get(jti) ?? null;
  if (userId) devSseTokens.delete(jti);
  return userId;
}
