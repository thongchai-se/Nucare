import { Role } from "@prisma/client";
import { Router } from "express";
import {
  getExecutiveDashboard,
  getExecutiveScreeningComparison,
  getExecutiveScreeningOverview,
  getExecutiveStudentDetail,
  listExecutiveStudents,
} from "../controllers/executive.controller";
import { getExecutiveAssessmentHistory } from "../controllers/assessment-history.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.EXECUTIVE));

router.get("/dashboard", getExecutiveDashboard);
router.get("/screening-overview", getExecutiveScreeningOverview);
router.get("/screening-comparison", getExecutiveScreeningComparison);
router.get("/students", listExecutiveStudents);
router.get("/students/:studentUserId/assessment-history", getExecutiveAssessmentHistory);
router.get("/students/:studentUserId", getExecutiveStudentDetail);

export default router;
