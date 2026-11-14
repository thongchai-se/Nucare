import { Role } from "@prisma/client";
import { Router } from "express";
import {
  cancelMentalHealthAppointment,
  clearScheduledMentalHealthAppointments,
  createMentalHealthAppointment,
  createSpecializedCareRecord,
  getMentalHealthDashboard,
  getMentalHealthReferralHistoryDetail,
  getMentalHealthStudentHistoryDetail,
  updateEmergencyCaseStatus,
  updateMentalHealthAppointmentStatus,
  updateReferralStatus,
} from "../controllers/mental-health.controller";
import { getMentalHealthAssessmentHistory } from "../controllers/assessment-history.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import { consultationRequestRateLimit } from "../middleware/rate-limit.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.MENTAL_HEALTH));

router.get("/dashboard", getMentalHealthDashboard);
router.get("/students/:studentUserId/history", getMentalHealthStudentHistoryDetail);
router.get("/students/:studentUserId/assessment-history", getMentalHealthAssessmentHistory);
router.get("/referrals/:referralId/history", getMentalHealthReferralHistoryDetail);
router.patch("/referrals/:referralId/status", updateReferralStatus);
router.patch("/emergency-cases/:caseId/status", updateEmergencyCaseStatus);
router.post("/care-records", createSpecializedCareRecord);
router.post("/appointments", consultationRequestRateLimit, createMentalHealthAppointment);
router.patch("/appointments/:appointmentId/cancel", consultationRequestRateLimit, cancelMentalHealthAppointment);
router.patch(
  "/appointments/:appointmentId/status",
  consultationRequestRateLimit,
  updateMentalHealthAppointmentStatus
);
router.post("/appointments/clear-scheduled", consultationRequestRateLimit, clearScheduledMentalHealthAppointments);

export default router;
