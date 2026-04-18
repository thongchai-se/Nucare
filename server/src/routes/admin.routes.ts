import { Role } from "@prisma/client";
import { Router } from "express";
import {
  checkExistingStudents,
  createStudent,
  deleteStudent,
  importStudents,
  listStudents,
  updateStudent,
} from "../controllers/admin.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/students/check-existing",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  checkExistingStudents
);

router.get(
  "/students",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  listStudents
);

router.post(
  "/students",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  createStudent
);

router.put(
  "/students/:id",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  updateStudent
);

router.delete(
  "/students/:id",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  deleteStudent
);

router.post(
  "/students/import",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  importStudents
);

export default router;
