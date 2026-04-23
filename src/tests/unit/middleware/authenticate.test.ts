// src/tests/unit/middleware/authenticate.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// FIXES vs previous version:
//   1. JWT_PRIVATE_KEY_TEST does not exist. globalSetup sets TEST_JWT_PRIVATE_KEY_PATH.
//      Tests that need raw private key now read from TEST_JWT_PRIVATE_KEY_PATH.
//   2. readFileSync import added.
//   3. All branches tested match what authenticate() actually does.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import type { Response, NextFunction } from "express";
import type { AuthRequest } from "../../../middleware/auth.js";

// ── Mock prisma BEFORE importing authenticate ─────────────────────────────────
vi.mock("../../../lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

import { authenticate } from "../../../middleware/auth.js";
import { prisma } from "../../../lib/prisma.js";
import {
  generateTestToken,
  expiredAuthHeaders,
  invalidAuthHeaders,
} from "../../helpers/auth.js";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────
const mockUser = {
  id: "user-test-001",
  email: "test@focura.com",
  name: "Test User",
  role: "USER" as const,
  emailVerified: new Date(),
  bannedAt: null,
  banReason: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeReq(authHeader?: string): AuthRequest {
  return { headers: { authorization: authHeader } } as AuthRequest;
}

function makeRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

const next: NextFunction = vi.fn();

/**
 * Reads the RSA private key set by globalSetup.
 * globalSetup writes the key to a temp file and sets TEST_JWT_PRIVATE_KEY_PATH.
 */
function getTestPrivateKey(): string {
  const keyPath = process.env.TEST_JWT_PRIVATE_KEY_PATH;
  if (!keyPath) {
    throw new Error(
      "TEST_JWT_PRIVATE_KEY_PATH is not set. " +
        "Ensure globalSetup.ts ran before this test file.",
    );
  }
  return readFileSync(keyPath, "utf-8");
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("authenticate middleware", () => {
  // ── Happy path ──────────────────────────────────────────────────────────────
  it("calls next() and attaches req.user for a valid token", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

    const token = generateTestToken(mockUser);
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith(); // no error argument
    expect(req.user?.id).toBe(mockUser.id);
    expect(req.user?.email).toBe(mockUser.email);
    expect(req.user?.role).toBe(mockUser.role);
    // Sensitive fields must NOT be on req.user
    expect((req.user as any)?.password).toBeUndefined();
    expect((req.user as any)?.bannedAt).toBeUndefined();
  });

  // ── Missing / malformed header ───────────────────────────────────────────────
  it("returns 401 NO_TOKEN when Authorization header is absent", async () => {
    const req = makeReq(undefined);
    const res = makeRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NO_TOKEN" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 NO_TOKEN when Authorization is not Bearer scheme", async () => {
    const req = makeReq("Basic dXNlcjpwYXNz");
    const res = makeRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NO_TOKEN" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 NO_TOKEN for empty Bearer string", async () => {
    const req = makeReq("Bearer ");
    const res = makeRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NO_TOKEN" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Invalid / malformed token ───────────────────────────────────────────────
  it("returns 401 INVALID_TOKEN for a completely malformed token", async () => {
    const req = makeReq(invalidAuthHeaders().Authorization);
    const res = makeRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "INVALID_TOKEN" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Expired token ───────────────────────────────────────────────────────────
  it("returns 401 TOKEN_EXPIRED for an expired token", async () => {
    const req = makeReq(expiredAuthHeaders(mockUser).Authorization);
    const res = makeRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "TOKEN_EXPIRED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── Token payload validation ────────────────────────────────────────────────
  it("returns 401 TOKEN_VERSION_MISMATCH for token with wrong version", async () => {
    // Read the key written by globalSetup (NOT JWT_PRIVATE_KEY_TEST — that doesn't exist)
    const privateKey = getTestPrivateKey();

    const { default: jwt } = await import("jsonwebtoken");
    const badVersionToken = jwt.sign(
      {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        type: "access",
        version: 99, // wrong version — middleware expects 1
        jti: "test-jti-bad-version",
        sessionId: "test-session",
      },
      privateKey,
      { algorithm: "RS256", issuer: "focura-app", audience: "focura-backend" },
    );

    const req = makeReq(`Bearer ${badVersionToken}`);
    const res = makeRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "TOKEN_VERSION_MISMATCH" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 INVALID_TOKEN_TYPE for refresh token used as access token", async () => {
    const privateKey = getTestPrivateKey();

    const { default: jwt } = await import("jsonwebtoken");
    const refreshToken = jwt.sign(
      {
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        type: "refresh", // wrong type — middleware expects 'access'
        version: 1,
        jti: "test-jti-refresh",
        sessionId: "test-session",
      },
      privateKey,
      { algorithm: "RS256", issuer: "focura-app", audience: "focura-backend" },
    );

    const req = makeReq(`Bearer ${refreshToken}`);
    const res = makeRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "INVALID_TOKEN_TYPE" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── DB-level checks ─────────────────────────────────────────────────────────
  it("returns 401 USER_NOT_FOUND when user was deleted after token issued", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const token = generateTestToken(mockUser);
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "USER_NOT_FOUND" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 EMAIL_NOT_VERIFIED for user with null emailVerified", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      emailVerified: null,
    } as any);

    const token = generateTestToken(mockUser);
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "EMAIL_NOT_VERIFIED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 ACCOUNT_BANNED for a banned user", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      ...mockUser,
      bannedAt: new Date(),
      banReason: "Terms of service violation",
    } as any);

    const token = generateTestToken(mockUser);
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "ACCOUNT_BANNED" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  // ── authorize() helper ───────────────────────────────────────────────────────
  it("authorize() — passes when user has required role", async () => {
    const { authorize } = await import("../../../middleware/auth.js");

    const req = {
      user: { id: "1", email: "a@b.com", role: "ADMIN" },
    } as AuthRequest;
    const res = makeRes();
    const authorizeNext: NextFunction = vi.fn();

    authorize("ADMIN", "USER")(req, res, authorizeNext);

    expect(authorizeNext).toHaveBeenCalledOnce();
    expect(authorizeNext).toHaveBeenCalledWith();
  });

  it("authorize() — returns 403 FORBIDDEN when user lacks required role", async () => {
    const { authorize } = await import("../../../middleware/auth.js");

    const req = {
      user: { id: "1", email: "a@b.com", role: "USER" },
    } as AuthRequest;
    const res = makeRes();
    const authorizeNext: NextFunction = vi.fn();

    authorize("ADMIN")(req, res, authorizeNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
    expect(authorizeNext).not.toHaveBeenCalled();
  });

  it("authorize() — returns 401 NOT_AUTHENTICATED when req.user is missing", async () => {
    const { authorize } = await import("../../../middleware/auth.js");

    const req = { headers: {} } as AuthRequest; // no req.user
    const res = makeRes();
    const authorizeNext: NextFunction = vi.fn();

    authorize("ADMIN")(req, res, authorizeNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "NOT_AUTHENTICATED" }),
    );
    expect(authorizeNext).not.toHaveBeenCalled();
  });
});
