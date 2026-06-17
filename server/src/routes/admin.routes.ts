import { Role } from "@prisma/client";
import { Router } from "express";
import {
  assignAdvisorStudents,
  bulkPromoteStudentStudyYear,
  checkExistingStaffUsers,
  createUser,
  listAuditLogs,
  listStaffUsers,
  checkExistingStudents,
  deleteUser,
  createStudent,
  importStaffUsers,
  listUsers,
  deleteStudent,
  importStudents,
  listStudents,
  updateUser,
  updateStudent,
} from "../controllers/admin.controller";
import {
  createAdminSurvey,
  deleteAdminSurvey,
  getAdminSurvey,
  listAdminSurveyResponses,
  listAdminSurveys,
  updateAdminSurvey,
} from "../controllers/survey.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.post(
  "/students/check-existing",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  checkExistingStudents
);

router.post(
  "/staff/check-existing",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  checkExistingStaffUsers
);

router.get(
  "/staff",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  listStaffUsers
);

router.get(
  "/users",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  listUsers
);

router.post(
  "/users",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  createUser
);

router.put(
  "/users/:id",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  updateUser
);

router.delete(
  "/users/:id",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  deleteUser
);

router.post(
  "/advisor-assignments",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  assignAdvisorStudents
);

router.get(
  "/audit-logs",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  listAuditLogs
);

router.get(
  "/surveys",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  listAdminSurveys
);

router.post(
  "/surveys",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  createAdminSurvey
);

router.get(
  "/surveys/:id",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  getAdminSurvey
);

router.put(
  "/surveys/:id",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  updateAdminSurvey
);

router.delete(
  "/surveys/:id",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  deleteAdminSurvey
);

router.get(
  "/surveys/:id/responses",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  listAdminSurveyResponses
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

router.post(
  "/staff/import",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  importStaffUsers
);

router.post(
  "/students/promote-study-year",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  bulkPromoteStudentStudyYear
);

export default router;
