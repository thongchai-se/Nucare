import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createSosCase,
  getStudentDashboard,
  submitAssessment,
} from "../controllers/student.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.STUDENT));

router.get("/dashboard", getStudentDashboard);
router.post("/assessments", submitAssessment);
router.post("/sos", createSosCase);

export default router;
