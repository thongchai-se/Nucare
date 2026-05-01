import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createBehaviorRecord,
  listBehaviorRecords,
  listInstructorStudents,
} from "../controllers/instructor.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.INSTRUCTOR));

router.get("/students", listInstructorStudents);
router.get("/behavior-records", listBehaviorRecords);
router.post("/behavior-records", createBehaviorRecord);

export default router;
