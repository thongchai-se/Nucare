import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createConsultationRequest,
  createSosCase,
  getStudentDashboard,
  listConsultationRequests,
  listConsultationTeachers,
  submitAssessment,
} from "../controllers/student.controller";
import {
  getActiveStudentSurvey,
  submitStudentSurveyResponse,
} from "../controllers/survey.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import {
  assessmentSubmitRateLimit,
  consultationRequestRateLimit,
  sosRateLimit,
  surveySubmitRateLimit,
} from "../middleware/rate-limit.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.STUDENT));

router.get("/dashboard", getStudentDashboard);
router.get("/consultation-teachers", listConsultationTeachers);
router.get("/consultation-requests", listConsultationRequests);
router.get("/surveys/active", getActiveStudentSurvey);
router.post("/assessments", assessmentSubmitRateLimit, submitAssessment);
router.post("/surveys/:id/responses", surveySubmitRateLimit, submitStudentSurveyResponse);
router.post("/consultation-requests", consultationRequestRateLimit, createConsultationRequest);
router.post("/sos", sosRateLimit, createSosCase);

export default router;
