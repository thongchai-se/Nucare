import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createSpecializedCareRecord,
  getMentalHealthDashboard,
  resolveEmergencyCase,
  updateReferralStatus,
} from "../controllers/mental-health.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.MENTAL_HEALTH));

router.get("/dashboard", getMentalHealthDashboard);
router.patch("/referrals/:referralId/status", updateReferralStatus);
router.post("/care-records", createSpecializedCareRecord);
router.patch("/emergency-cases/:caseId/resolve", resolveEmergencyCase);

export default router;
