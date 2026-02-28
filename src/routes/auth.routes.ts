
import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../index.js";
import {
  createTokenPair, createSseToken, verifyToken,
  extractJti, parseExpiry, REFRESH_TOKEN_EXPIRY,
} from "../lib/auth/backendToken.js";
import {
  storeRefreshToken, rotateRefreshToken, revokeAccessToken,
  revokeAllRefreshTokens, isRefreshTokenValid, storeSseToken,
} from "../lib/auth/tokenRevocation.js";
import { auditLog } from "../lib/auth/auditLog.js";

const router = Router();
const getIp = (req: any) => (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

function verifyExchangeProof(payload: string, signature: string): boolean {
  const secret = process.env.NEXTAUTH_SECRET!;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch { return false; }
}

router.post("/exchange", async (req, res) => {
  const ip = getIp(req);
  try {
    const { userId, email, role, sessionId, timestamp, signature } = req.body;

    if (!userId || !email || !role || !sessionId || !timestamp || !signature) {
      return res.status(400).json({ success: false, message: "Missing required fields", code: "MISSING_FIELDS" });
    }

    const age = Date.now() - Number(timestamp);
    if (age > 60_000 || age < 0) {
      auditLog("EXCHANGE_FAILED", { userId, email, ip, reason: "Proof expired" });
      return res.status(401).json({ success: false, message: "Exchange proof expired", code: "PROOF_EXPIRED" });
    }

    const payload = `${userId}${email}${role}${sessionId}${timestamp}`;
    if (!verifyExchangeProof(payload, signature)) {
      auditLog("EXCHANGE_FAILED", { userId, email, ip, reason: "Invalid signature" });
      return res.status(401).json({ success: false, message: "Invalid exchange proof", code: "INVALID_PROOF" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, emailVerified: true },
    });

    if (!user || !user.emailVerified) {
      return res.status(401).json({ success: false, message: "User not found or not verified", code: "USER_INVALID" });
    }

    const tokens = createTokenPair({ id: user.id, email: user.email, role: user.role, sessionId });

    await storeRefreshToken(user.id, extractJti(tokens.refreshToken), parseExpiry(REFRESH_TOKEN_EXPIRY) / 1000);

    auditLog("EXCHANGE_SUCCESS", { userId: user.id, email: user.email, ip, sessionId });

    return res.json({
      success: true,
      accessToken:        tokens.accessToken,
      refreshToken:       tokens.refreshToken,
      accessTokenExpiry:  tokens.accessTokenExpiry,
      refreshTokenExpiry: tokens.refreshTokenExpiry,
    });
  } catch (err) {
    console.error("Exchange error:", err);
    auditLog("EXCHANGE_FAILED", { ip, reason: (err as Error).message });
    return res.status(500).json({ success: false, message: "Exchange failed", code: "EXCHANGE_ERROR" });
  }
});

router.post("/refresh", async (req, res) => {
  const ip = getIp(req);
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: "Refresh token required" });

    const decoded = verifyToken(refreshToken, "refresh");
    const isValid = await isRefreshTokenValid(decoded.id, decoded.jti);

    if (!isValid) {
      auditLog("TOKEN_REPLAY_DETECTED", { userId: decoded.id, jti: decoded.jti, ip, reason: "Refresh token already used or revoked" });
      return res.status(401).json({ success: false, message: "Refresh token invalid or already used", code: "TOKEN_INVALID" });
    }

    const tokens = createTokenPair({ id: decoded.id, email: decoded.email, role: decoded.role, sessionId: decoded.sessionId });
    const rotated = await rotateRefreshToken(decoded.id, decoded.jti, extractJti(tokens.refreshToken), parseExpiry(REFRESH_TOKEN_EXPIRY) / 1000);

    if (!rotated) {
      return res.status(401).json({ success: false, message: "Token rotation failed", code: "ROTATION_FAILED" });
    }

    auditLog("TOKEN_REFRESHED", { userId: decoded.id, ip, sessionId: decoded.sessionId });

    return res.json({
      success: true,
      accessToken:        tokens.accessToken,
      refreshToken:       tokens.refreshToken,
      accessTokenExpiry:  tokens.accessTokenExpiry,
      refreshTokenExpiry: tokens.refreshTokenExpiry,
    });
  } catch (err: any) {
    if (err.name === "TokenExpiredError") return res.status(401).json({ success: false, message: "Refresh token expired", code: "TOKEN_EXPIRED" });
    return res.status(401).json({ success: false, message: "Token refresh failed", code: "REFRESH_FAILED" });
  }
});

router.post("/logout", async (req, res) => {
  const ip = getIp(req);
  const { logoutAll = false } = req.body ?? {};

  let userId: string | undefined;
  let tokenJti: string | undefined;
  let sessionId: string | undefined;
  let email: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token   = authHeader.slice(7).trim();
      const decoded = verifyToken(token, "access");
      userId    = decoded.id;
      tokenJti  = decoded.jti;
      sessionId = decoded.sessionId;
      email     = decoded.email;
    } catch {
      // Token expired or invalid — that's fine, we still complete the logout
    }
  }

  try {
    if (process.env.UPSTASH_REDIS_REST_URL) {
      if (tokenJti) await revokeAccessToken(tokenJti, 900);
      if (logoutAll && userId) await revokeAllRefreshTokens(userId);
    }

    auditLog(logoutAll ? "LOGOUT_ALL_DEVICES" : "LOGOUT", {
      userId, email, ip, sessionId,
    });

    return res.json({
      success: true,
      message: logoutAll ? "Logged out from all devices" : "Logged out successfully",
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.json({ success: true, message: "Logged out" });
  }
});

export default router;
