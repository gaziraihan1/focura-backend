import jwt from "jsonwebtoken";

export const BACKEND_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

export function createBackendToken(payload: {
  id: string;
  email: string;
  role?: string;
}) {
  const secret = process.env.BACKEND_JWT_SECRET!;
  if (!secret) throw new Error("BACKEND_JWT_SECRET is not set");

  return jwt.sign(
    { sub: payload.id, email: payload.email, role: payload.role ?? "USER" },
    secret,
    {
      expiresIn: BACKEND_TOKEN_EXPIRY_MS,
      issuer: "focura-app",
      audience: "focura-backend",
      algorithm: "HS256",
    }
  );
}
