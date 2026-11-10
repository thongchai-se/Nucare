import { Role } from "@prisma/client";
import { Router } from "express";
import {
  cancelConsultationRequest,
  createConsultationRequest,
  createSosCase,
  createStudentCounselingRequest,
  getStudentDashboard,
  listConsultationRequests,
  listConsultationTeachers,
  submitAssessment,
} from "../controllers/student.controller";
import {
  acceptConsultationScheduleOffer,
  createConsultationScheduleOffer,
} from "../controllers/consultation-schedule.controller";
import {
  getStudentChatMemoryGreeting,
  listStudentChatPersonas,
  postStudentChatMessage,
} from "../controllers/student-chat.controller";
import {
  getActiveStudentSurvey,
  submitStudentSurveyResponse,
} from "../controllers/survey.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import {
  assessmentSubmitRateLimit,
  consultationRequestRateLimit,
  sosRateLimit,
  studentChatRateLimit,
  surveySubmitRateLimit,
} from "../middleware/rate-limit.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.STUDENT));

router.get("/dashboard", getStudentDashboard);
router.get("/consultation-teachers", listConsultationTeachers);
router.get("/consultation-requests", listConsultationRequests);
router.get("/surveys/active", getActiveStudentSurvey);
router.get("/chat/personas", listStudentChatPersonas);
router.get("/chat/memory", getStudentChatMemoryGreeting);
router.post("/chat", studentChatRateLimit, postStudentChatMessage);
router.post("/assessments", assessmentSubmitRateLimit, submitAssessment);
router.post("/surveys/:id/responses", surveySubmitRateLimit, submitStudentSurveyResponse);
router.post("/consultation-requests", consultationRequestRateLimit, createConsultationRequest);
router.post(
  "/counseling-requests",
  consultationRequestRateLimit,
  createStudentCounselingRequest
);
router.post(
  "/consultation-requests/:requestId/cancel",
  consultationRequestRateLimit,
  cancelConsultationRequest
);
router.post(
  "/consultation-requests/:requestId/schedule-offers",
  consultationRequestRateLimit,
  createConsultationScheduleOffer
);
router.post(
  "/consultation-requests/:requestId/schedule-offers/:offerId/accept",
  consultationRequestRateLimit,
  acceptConsultationScheduleOffer
);
router.post("/sos", sosRateLimit, createSosCase);

export default router;
