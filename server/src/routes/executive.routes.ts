import { Role } from "@prisma/client";
import { Router } from "express";
import {
  getExecutiveDashboard,
  getExecutiveScreeningComparison,
  getExecutiveStudentDetail,
  listExecutiveStudents,
} from "../controllers/executive.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.EXECUTIVE));

router.get("/dashboard", getExecutiveDashboard);
router.get("/screening-comparison", getExecutiveScreeningComparison);
router.get("/students", listExecutiveStudents);
router.get("/students/:studentUserId", getExecutiveStudentDetail);

export default router;
