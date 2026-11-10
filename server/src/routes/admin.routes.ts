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
  getAdminReportsSummary,
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
import {
  closeAdminSurveyWave,
  createAdminSurveyWave,
  listAdminSurveyWaveResponses,
  listAdminSurveyWaves,
  openAdminSurveyWave,
  previewAdminSurveyEligibility,
} from "../controllers/survey-wave.controller";
import { pullExternalDirectory, pullExternalDirectoryCatalog } from "../controllers/external-directory.controller";
import {
  createSiteMedia,
  deleteSiteMedia,
  listAdminSiteMedia,
  updateSiteMedia,
} from "../controllers/site-media.controller";
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
  "/surveys/:id/waves",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  listAdminSurveyWaves
);

router.post(
  "/surveys/:id/waves",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  createAdminSurveyWave
);

router.post(
  "/surveys/:id/waves/:waveId/open",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  openAdminSurveyWave
);

router.post(
  "/surveys/:id/waves/:waveId/close",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  closeAdminSurveyWave
);

router.get(
  "/surveys/:id/waves/:waveId/responses",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  listAdminSurveyWaveResponses
);

router.post(
  "/surveys/:id/eligibility-preview",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  previewAdminSurveyEligibility
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

router.get(
  "/external-directory/catalog",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  pullExternalDirectoryCatalog
);

router.get(
  "/external-directory",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  pullExternalDirectory
);

router.post(
  "/students/promote-study-year",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  bulkPromoteStudentStudyYear
);

router.get(
  "/reports/summary",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  getAdminReportsSummary
);

router.get(
  "/site-media",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  listAdminSiteMedia
);

router.post(
  "/site-media",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  createSiteMedia
);

router.put(
  "/site-media/:id",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  updateSiteMedia
);

router.delete(
  "/site-media/:id",
  authenticateToken,
  authorizeRoles(Role.ADMIN),
  deleteSiteMedia
);

export default router;
