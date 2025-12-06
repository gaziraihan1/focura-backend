import { Router, Request, Response } from "express";
import { prisma } from "../index.js";
import { createBackendToken } from "../lib/auth/backendToken.js";
import * as argon2 from "argon2";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing credentials" });

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, role: true, name: true },
    });

    if (!user || !(await argon2.verify(user.password, password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = createBackendToken({ id: user.id, role: user.role });

    res.cookie("backendToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60 * 1000, 
    });

    res.json({
      success: true,
      message: "Logged in successfully",
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post('/logout', (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === "production";
  const BACKEND_COOKIE_NAME = isProd ? "__Secure-focura.backend" : "focura.backend";
  
  res.clearCookie(BACKEND_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });
  
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
