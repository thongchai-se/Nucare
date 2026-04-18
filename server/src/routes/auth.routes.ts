import { Router } from "express";
import {
  forgotPassword,
  login,
  logout,
  me,
  resetPassword,
  refresh,
} from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/logout", logout);
router.get("/me", authenticateToken, me);
router.post("/refresh", refresh);

export default router;
