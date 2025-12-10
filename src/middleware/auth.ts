// middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { prisma } from "../index.js";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name?: string | null;
  };
}

const {TokenExpiredError, JsonWebTokenError} = jwt
export const authenticate = async (
  req: AuthRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith("Bearer ")) {
      if (process.env.NODE_ENV === 'development') {
        console.log("⚠️  No Authorization header found");
      }
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required"
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Validate token is not empty
    if (!token || token.trim() === '') {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token format"
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("🔵 Authenticating token from Authorization header");
    }

    // Verify JWT secret is configured
    if (!process.env.BACKEND_JWT_SECRET) {
      console.error("❌ BACKEND_JWT_SECRET is not configured!");
      return res.status(500).json({ 
        success: false, 
        message: "Server configuration error"
      });
    }

    // Verify JWT with additional options for security
    const decoded = jwt.verify(token, process.env.BACKEND_JWT_SECRET, {
      algorithms: ['HS256'], // Explicitly specify allowed algorithm
      issuer: 'focura-app', // Match what you set when creating token
    }) as JwtPayload;

    // Validate decoded token has required fields
    if (!decoded.sub) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token payload"
      });
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { 
        id: true, 
        email: true, 
        name: true, 
        role: true,
        emailVerified: true, // Check if email is verified
      }
    });

    if (!user) {
      if (process.env.NODE_ENV === 'development') {
        console.log("❌ User not found for ID:", decoded.sub);
      }
      return res.status(401).json({ 
        success: false, 
        message: "User not found"
      });
    }

   
    if (!user.emailVerified) {
      return res.status(403).json({ 
        success: false, 
        message: "Please verify your email"
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log("✅ User authenticated:", user.email);
    }

    // Remove emailVerified from user object before attaching to request
    const { emailVerified, ...userWithoutEmailVerified } = user;
    req.user = userWithoutEmailVerified;
    next();

  } catch (err) {
    // Handle specific JWT errors
    if (err instanceof TokenExpiredError) {
      console.error('🔴 Token expired:', err.expiredAt);
      return res.status(401).json({ 
        success: false, 
        message: "Token has expired. Please login again.",
        code: 'TOKEN_EXPIRED'
      });
    }

    if (err instanceof JsonWebTokenError) {
      console.error('🔴 Invalid token:', err.message);
      return res.status(401).json({ 
        success: false, 
        message: "Invalid token",
        code: 'INVALID_TOKEN'
      });
    }

    // Handle other errors
    console.error('🔴 Authentication error:', err);
    return res.status(401).json({ 
      success: false, 
      message: "Authentication failed",
      error: process.env.NODE_ENV === 'development' ? (err as Error).message : undefined
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    if (!roles.includes(req.user.role)) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚠️  Access denied. Required: [${roles.join(', ')}], User has: ${req.user.role}`);
      }
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Insufficient permissions.",
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Optional: Add rate limiting per user
const userRequestCounts = new Map<string, { count: number; resetTime: number }>();

export const rateLimitByUser = (maxRequests: number = 100, windowMs: number = 60000) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const userLimit = userRequestCounts.get(userId);

    if (!userLimit || now > userLimit.resetTime) {
      userRequestCounts.set(userId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
    }

    userLimit.count++;
    next();
  };
};