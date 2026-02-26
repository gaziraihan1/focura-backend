// backend/src/routes/internal.routes.ts
// Internal-only endpoints called server-to-server from Next.js.
// Protected by INTERNAL_AUTH_SECRET — NEVER expose these to the internet.
// Add to your router: app.use("/api/auth", internalRouter)
// (same prefix as auth.routes.ts, they merge)

import { Router, Request, Response, NextFunction } from "express";
import { clearFailedAttempts, recordFailedAttempt } from "../lib/auth/accountLockout.js";


const router = Router();

// ─── Internal secret guard ────────────────────────────────────────────────────

function requireInternalSecret(req: Request, res: Response, next: NextFunction) {
  const secret = req.headers["x-internal-secret"];
  if (!secret || secret !== process.env.INTERNAL_AUTH_SECRET) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  next();
}

// Apply to all routes in this router
router.use(requireInternalSecret);

// ─── Routes ───────────────────────────────────────────────────────────────────


router.post("/failed-attempt", async (req, res) => {
  const { email, ip } = req.body;
  if (!email) return res.status(400).json({ success: false });
  await recordFailedAttempt(email);
  return res.json({ success: true });
});

router.post("/clear-attempts", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false });
  await clearFailedAttempts(email);
  return res.json({ success: true });
});

export default router;
