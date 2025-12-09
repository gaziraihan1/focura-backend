import jwt from "jsonwebtoken";
import { prisma } from "../index.js";
const isProd = process.env.NODE_ENV === "production";
const BACKEND_COOKIE_NAME = isProd ? "__Secure-focura.backend" : "focura.backend";
// Manual cookie parser fallback
function parseCookies(cookieHeader) {
    if (!cookieHeader)
        return {};
    return cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value)
            acc[key] = value;
        return acc;
    }, {});
}
export const authenticate = async (req, res, next) => {
    try {
        // Try cookie-parser first
        let backendToken = req.cookies?.[BACKEND_COOKIE_NAME];
        // Fallback to manual parsing
        if (!backendToken && req.headers.cookie) {
            const manualCookies = parseCookies(req.headers.cookie);
            backendToken = manualCookies[BACKEND_COOKIE_NAME];
            console.log('⚠️ Using manual cookie parsing:', {
                found: !!backendToken,
                cookieName: BACKEND_COOKIE_NAME
            });
        }
        // console.log('🔍 Auth Debug:', {
        //   cookieName: BACKEND_COOKIE_NAME,
        //   hasCookieParser: !!req.cookies,
        //   parsedCookies: req.cookies,
        //   rawCookieHeader: req.headers.cookie?.substring(0, 100) + '...',
        //   tokenFound: !!backendToken,
        //   environment: process.env.NODE_ENV
        // });
        if (!backendToken) {
            return res.status(401).json({
                success: false,
                message: "Not authenticated - no token found",
                debug: {
                    expectedCookie: BACKEND_COOKIE_NAME,
                    receivedCookies: Object.keys(req.cookies || {})
                }
            });
        }
        const decoded = jwt.verify(backendToken, process.env.BACKEND_JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.sub },
            select: { id: true, email: true, name: true, role: true }
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found"
            });
        }
        req.user = user;
        // console.log(req.user)
        next();
    }
    catch (err) {
        console.error('🔴 Auth Error:', err);
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token",
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }
        next();
    };
};
//# sourceMappingURL=auth.js.map