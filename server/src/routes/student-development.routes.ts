import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createStudentDevelopmentReminder,
  getStudentDevelopmentDashboard,
  updateStudentDevelopmentReferralStatus,
} from "../controllers/student-development.controller";
import {
  createSiteMedia,
  deleteSiteMedia,
  listManagedSiteMedia,
  updateSiteMedia,
} from "../controllers/site-media.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.STUDENT_DEVELOPMENT));

router.get("/dashboard", getStudentDevelopmentDashboard);
router.post("/screening-reminders", createStudentDevelopmentReminder);
router.patch("/referrals/:referralId/status", updateStudentDevelopmentReferralStatus);

/** จัดการภาพประชาสัมพันธ์หน้านิสิต (ช่อง STUDENT_ACTIVITY เท่านั้น — บังคับใน controller) */
router.get("/site-media", listManagedSiteMedia);
router.post("/site-media", createSiteMedia);
router.put("/site-media/:id", updateSiteMedia);
router.delete("/site-media/:id", deleteSiteMedia);

export default router;
