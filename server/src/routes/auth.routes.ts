import { Router } from "express";
import { login, logout, me, session, refresh } from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import { loginRateLimit, refreshRateLimit } from "../middleware/rate-limit.middleware";

const router = Router();

router.post("/login", loginRateLimit, login);
router.post("/logout", logout);
router.get("/session", session);
router.get("/me", authenticateToken, me);
router.post("/refresh", refreshRateLimit, refresh);

export default router;
