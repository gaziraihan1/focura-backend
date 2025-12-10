import jwt from "jsonwebtoken";
export const BACKEND_TOKEN_EXPIRY = "15m"; // short-lived
export function createBackendToken(payload) {
    const secret = process.env.BACKEND_JWT_SECRET;
    if (!secret)
        throw new Error("BACKEND_JWT_SECRET is not set");
    return jwt.sign({ sub: payload.id, email: payload.email, role: payload.role ?? "USER" }, secret, {
        expiresIn: BACKEND_TOKEN_EXPIRY,
        issuer: "focura-app",
        algorithm: "HS256",
    });
}
//# sourceMappingURL=backendToken.js.map