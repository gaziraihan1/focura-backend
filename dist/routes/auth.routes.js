import { Router } from "express";
import { prisma } from "../index.js";
import { createBackendToken } from "../lib/auth/backendToken.js";
import * as argon2 from "argon2";
// import jwt from "jsonwebtoken";
const router = Router();
// const isProd = process.env.NODE_ENV === "production";
// const BACKEND_COOKIE_NAME = isProd ? "__Secure-focura.backend" : "focura.backend";
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, error: "Missing credentials" });
        }
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, password: true, role: true, name: true },
        });
        if (!user || !user.password) {
            return res.status(401).json({ success: false, error: "Invalid credentials" });
        }
        const isValid = await argon2.verify(user.password, password);
        if (!isValid) {
            return res.status(401).json({ success: false, error: "Invalid credentials" });
        }
        const token = createBackendToken({
            id: user.id,
            email: user.email,
            role: user.role,
        });
        console.log("✅ Login successful, token generated");
        res.json({
            success: true,
            message: "Logged in successfully",
            user: { id: user.id, email: user.email, name: user.name, role: user.role },
            token, // frontend will store this
        });
    }
    catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});
export default router;
//# sourceMappingURL=auth.routes.js.map