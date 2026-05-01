import { Router } from "express";
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  me,
  resetPassword,
  validateResetPasswordToken,
  refresh,
} from "../controllers/auth.controller";
import { authenticateToken } from "../middleware/auth.middleware";
import {
  changePasswordRateLimit,
  forgotPasswordRateLimit,
  loginRateLimit,
  refreshRateLimit,
  resetPasswordRateLimit,
} from "../middleware/rate-limit.middleware";

const router = Router();

router.post("/login", loginRateLimit, login);
router.post("/forgot-password", forgotPasswordRateLimit, forgotPassword);
router.get("/reset-password/validate", validateResetPasswordToken);
router.post("/reset-password", resetPasswordRateLimit, resetPassword);
router.post("/change-password", authenticateToken, changePasswordRateLimit, changePassword);
router.post("/logout", logout);
router.get("/me", authenticateToken, me);
router.post("/refresh", refreshRateLimit, refresh);

export default router;
