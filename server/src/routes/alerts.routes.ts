import { Router } from "express";
import { acknowledgeAlert, closeAlert, listMyAlerts } from "../controllers/alerts.controller";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken);

router.get("/me", listMyAlerts);
router.patch("/:alertId/acknowledge", acknowledgeAlert);
router.patch("/:alertId/close", closeAlert);

export default router;
