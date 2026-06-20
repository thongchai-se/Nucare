import { Role } from "@prisma/client";
import { Router } from "express";
import { getExecutiveDashboard } from "../controllers/executive.controller";
import { authenticateToken, authorizeRoles } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticateToken, authorizeRoles(Role.EXECUTIVE));

router.get("/dashboard", getExecutiveDashboard);

export default router;
