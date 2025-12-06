// lib/auth/backendToken.ts
import jwt from "jsonwebtoken";

// Longer expiry for cookie-based backend auth
const BACKEND_TOKEN_EXPIRY = "7d";  

export function createBackendToken(payload: {
    id: string;
    role?: string;
}) {
    const secret = process.env.BACKEND_JWT_SECRET!;

    if (!secret) {
        throw new Error("BACKEND_JWT_SECRET is not defined in environment variables.");
    }

    return jwt.sign(
        { 
            sub: payload.id, 
            role: payload.role ?? "USER"
        },
        secret,
        { 
            expiresIn: BACKEND_TOKEN_EXPIRY,
            issuer: "focura-app",
            algorithm: 'HS256'
        }
    );
}
