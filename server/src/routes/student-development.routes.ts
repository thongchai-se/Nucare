import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createStudentDevelopmentReminder,
  getStudentDevelopmentDashboard,
  updateStudentDevelopmentReferralStatus,
} from "../controllers/student-development.controller";
import {
  makeAcknowledgeScreeningReview,
  makeCreateReferralFromScreening,
  makeGetScreeningReviewDetail,
  makeListScreeningReviews,
} from "../controllers/screening-review.controller";
import {
  createSiteMedia,
  deleteSiteMedia,
  listManagedSiteMedia,
  reorderSiteMedia,
  updateSiteMedia,
} from "../controllers/site-media.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.STUDENT_DEVELOPMENT));

router.get("/dashboard", getStudentDevelopmentDashboard);
router.post("/screening-reminders", createStudentDevelopmentReminder);
router.patch("/referrals/:referralId/status", updateStudentDevelopmentReferralStatus);

/** คิวทบทวนผลคัดกรอง MEDIUM/HIGH — ส่งต่อได้เฉพาะเมื่อเจ้าหน้าที่กดเอง ไม่สร้างอัตโนมัติ */
router.get("/screening-reviews", makeListScreeningReviews("staff"));
router.get("/screening-reviews/:responseId", makeGetScreeningReviewDetail("staff"));
router.post("/screening-reviews/:responseId/acknowledge", makeAcknowledgeScreeningReview("staff"));
router.post("/screening-reviews/:responseId/referrals", makeCreateReferralFromScreening("staff"));

/** จัดการภาพประชาสัมพันธ์หน้านิสิต (ช่อง STUDENT_ACTIVITY เท่านั้น — บังคับใน controller) */
router.get("/site-media", listManagedSiteMedia);
router.post("/site-media", createSiteMedia);
router.put("/site-media/reorder", reorderSiteMedia);
router.put("/site-media/:id", updateSiteMedia);
router.delete("/site-media/:id", deleteSiteMedia);

export default router;
