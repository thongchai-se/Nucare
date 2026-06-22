import { Role } from "@prisma/client";
import { Router } from "express";
import { getExecutiveDashboard, getExecutiveScreeningComparison } from "../controllers/executive.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.EXECUTIVE));

router.get("/dashboard", getExecutiveDashboard);
router.get("/screening-comparison", getExecutiveScreeningComparison);

export default router;
