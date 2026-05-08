import jwt        from 'jsonwebtoken';
import crypto     from 'crypto';
import { readFileSync } from 'fs';
import type { User } from '@prisma/client';

// ── Private key (lazy-loaded, cached) ────────────────────────────────────────
let _cachedPrivateKey: string | null = null;

function getPrivateKey(): string {
  if (_cachedPrivateKey) return _cachedPrivateKey;

  // 1. From disk path written by globalSetup
  const testPath = process.env.TEST_JWT_PRIVATE_KEY_PATH;
  if (testPath) {
    try {
      _cachedPrivateKey = readFileSync(testPath, 'utf-8');
      return _cachedPrivateKey;
    } catch {
      // File not written yet — fall through
    }
  }

  // 2. Your project's actual private key (./keys/private.pem)
  const projectPath = process.env.JWT_PRIVATE_KEY_PATH ?? './keys/private.pem';
  try {
    _cachedPrivateKey = readFileSync(projectPath, 'utf-8');
    return _cachedPrivateKey;
  } catch {
    // File doesn't exist — fall through
  }

  // 3. Base64-encoded env var
  if (process.env.JWT_PRIVATE_KEY) {
    _cachedPrivateKey = Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf-8');
    return _cachedPrivateKey;
  }

  throw new Error(
    '[auth helper] Cannot resolve RSA private key.\n' +
    'Ensure one of these is set:\n' +
    '  - TEST_JWT_PRIVATE_KEY_PATH (set by globalSetup.ts)\n' +
    '  - JWT_PRIVATE_KEY_PATH=./keys/private.pem (in .env.test)\n' +
    '  - JWT_PRIVATE_KEY=<base64> (in .env.test)\n' +
    'Run: node scripts/generate-keys.js if keys don\'t exist.'
  );
}

// ── Token generation ──────────────────────────────────────────────────────────

export interface TokenOptions {
  expiresIn?: string | number;
  sessionId?: string;
  jti?: string;
}

/**
 * Creates a valid RS256 access token for a test user.
 * Payload matches your backendToken.ts createTokenPair() exactly.
 */
export function generateTestToken(
  user: Pick<User, 'id' | 'email' | 'role'>,
  opts: TokenOptions = {}
): string {
  return jwt.sign(
    {
      sub:       user.id,
      email:     user.email,
      role:      user.role,
      type:      'access',
      version:   1,
      jti:       opts.jti ?? crypto.randomUUID(),
      sessionId: opts.sessionId ?? crypto.randomUUID(),
    },
    getPrivateKey(),
    {
      algorithm: 'RS256',
      expiresIn: (opts.expiresIn ?? '1h') as any,
      issuer:    'focura-app',
      audience:  'focura-backend',
    }
  );
}

/** Ready-to-use header object for supertest .set() */
export function authHeaders(
  user: Pick<User, 'id' | 'email' | 'role'>
): { Authorization: string } {
  return { Authorization: `Bearer ${generateTestToken(user)}` };
}

/** Expired token → 401 TOKEN_EXPIRED */
export function expiredAuthHeaders(
  user: Pick<User, 'id' | 'email' | 'role'>
): { Authorization: string } {
  return { Authorization: `Bearer ${generateTestToken(user, { expiresIn: -1 })}` };
}

/** Syntactically invalid token → 401 INVALID_TOKEN */
export function invalidAuthHeaders(): { Authorization: string } {
  return { Authorization: 'Bearer not.a.real.jwt' };
}

// ── Exchange proof ────────────────────────────────────────────────────────────
// Builds the HMAC-SHA256 proof that /api/auth/exchange verifies.
// Uses the same algorithm as verifyExchangeProof() in auth.routes.ts.

export function buildExchangeProof(params: {
  userId: string;
  email:  string;
  role:   string;
  sessionId: string;
  timestamp: number;
}): string {
  const secret  = process.env.NEXTAUTH_SECRET!;
  const payload = `${params.userId}${params.email}${params.role}${params.sessionId}${params.timestamp}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}