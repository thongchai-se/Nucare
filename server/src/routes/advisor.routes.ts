import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createCareRecord,
  createReferral,
  getStudentHistory,
  listAdvisorReferrals,
  listAdvisorStudents,
} from "../controllers/advisor.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(
  authenticateToken,
  authorizeRoles(Role.ADVISOR)
);

router.get("/students", listAdvisorStudents);
router.get("/referrals", listAdvisorReferrals);
router.get("/students/:studentUserId/history", getStudentHistory);
router.post("/students/:studentUserId/care-records", createCareRecord);
router.post("/students/:studentUserId/referrals", createReferral);

export default router;
