import { Router } from "express";
import { recordConsent } from "../controllers/consent.controller";
import { consentRateLimit } from "../middleware/rate-limit.middleware";

const router = Router();

router.post("/", consentRateLimit, recordConsent);

export default router;
