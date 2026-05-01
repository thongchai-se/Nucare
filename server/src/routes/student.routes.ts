import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createSosCase,
  getStudentDashboard,
  submitAssessment,
} from "../controllers/student.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";
import { assessmentSubmitRateLimit, sosRateLimit } from "../middleware/rate-limit.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.STUDENT));

router.get("/dashboard", getStudentDashboard);
router.post("/assessments", assessmentSubmitRateLimit, submitAssessment);
router.post("/sos", sosRateLimit, createSosCase);

export default router;
