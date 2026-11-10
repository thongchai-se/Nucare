import { Role } from "@prisma/client";
import { Router } from "express";
import {
  createCareRecord,
  createObservationRecord,
  createReferral,
  getStudentHistory,
  listAdvisorConsultationRequests,
  listAdvisorReferrals,
  listAdvisorStudents,
  listObservationRecords,
  searchObservationStudents,
  updateAdvisorConsultationRequest,
} from "../controllers/advisor.controller";
import {
  acceptConsultationScheduleOffer,
  createConsultationScheduleOffer,
} from "../controllers/consultation-schedule.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(
  authenticateToken,
  authorizeRoles(Role.ADVISOR)
);

router.get("/students", listAdvisorStudents);
router.get("/referrals", listAdvisorReferrals);
router.get("/consultation-requests", listAdvisorConsultationRequests);
router.patch("/consultation-requests/:requestId", updateAdvisorConsultationRequest);
router.post("/consultation-requests/:requestId/schedule-offers", createConsultationScheduleOffer);
router.post(
  "/consultation-requests/:requestId/schedule-offers/:offerId/accept",
  acceptConsultationScheduleOffer
);
router.get("/students/:studentUserId/history", getStudentHistory);
router.post("/students/:studentUserId/care-records", createCareRecord);
router.post("/students/:studentUserId/referrals", createReferral);
router.get("/observation-students", searchObservationStudents);
router.get("/observation-records", listObservationRecords);
router.post("/observation-records", createObservationRecord);

export default router;
