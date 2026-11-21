import { Router } from "express";
import { getPublicSiteSettings } from "../controllers/site-settings.controller";

const router = Router();

/** สาธารณะ — โหมดปิดปรับปรุง + ข้อมูลติดต่อคณะ */
router.get("/public", getPublicSiteSettings);

export default router;
