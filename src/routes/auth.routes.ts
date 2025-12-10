import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { createBackendToken } from "../lib/auth/backendToken.js";
import * as argon2 from "argon2";
import jwt from "jsonwebtoken";

const router = Router();

const isProd = process.env.NODE_ENV === "production";
const BACKEND_COOKIE_NAME = isProd ? "__Secure-focura.backend" : "focura.backend";

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing credentials" 
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, role: true, name: true },
    });

    // Check if user exists and has a password (not OAuth user)
    if (!user || !user.password) {
      return res.status(401).json({ 
        success: false, 
        error: "Invalid credentials" 
      });
    }

    // Verify password
    const isValid = await argon2.verify(user.password, password);
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        error: "Invalid credentials" 
      });
    }

    // Create backend token
    const token = createBackendToken({ 
      id: user.id, 
      email: user.email, 
      role: user.role 
    });

    // Set cookie
    res.cookie(BACKEND_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    console.log("✅ Login successful, cookie set:", BACKEND_COOKIE_NAME);

    res.json({
      success: true,
      message: "Logged in successfully",
      user: { 
        id: user.id, 
        email: user.email, 
        name: user.name, 
        role: user.role 
      },
      token, // Also return token in response body for frontend to store
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ 
      success: false, 
      error: "Internal server error" 
    });
  }
});

// Set cookie endpoint for OAuth flow
router.post("/set-cookie", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    
    console.log("🔵 Received set-cookie request");
    console.log("🔵 Has token:", !!token);
    
    if (!token) {
      return res.status(400).json({ 
        success: false, 
        error: "Token required" 
      });
    }

    // Verify the token is valid
    try {
      const decoded = jwt.verify(token, process.env.BACKEND_JWT_SECRET!);
      console.log("✅ Token verified for user:", decoded.sub);
    } catch (err) {
      console.error("❌ Invalid token:", err);
      return res.status(401).json({ 
        success: false, 
        error: "Invalid token" 
      });
    }

    // Set cookie
    res.cookie(BACKEND_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    console.log("✅ Cookie set:", BACKEND_COOKIE_NAME);

    res.json({ 
      success: true, 
      message: "Cookie set successfully",
      cookieName: BACKEND_COOKIE_NAME
    });
  } catch (error) {
    console.error("❌ Set cookie error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to set cookie" 
    });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie(BACKEND_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
  
  console.log("✅ Logout successful, cookie cleared");
  
  res.json({ 
    success: true, 
    message: 'Logged out successfully' 
  });
});

export default router;