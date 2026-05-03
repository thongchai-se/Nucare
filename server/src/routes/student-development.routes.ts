import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createStudentDevelopmentReminder,
  getStudentDevelopmentDashboard,
} from "../controllers/student-development.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.STUDENT_DEVELOPMENT));

router.get("/dashboard", getStudentDevelopmentDashboard);
router.post("/screening-reminders", createStudentDevelopmentReminder);

export default router;
