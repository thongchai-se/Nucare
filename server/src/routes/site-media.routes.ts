import { Router } from "express";
import { listPublicSiteMedia } from "../controllers/site-media.controller";

const router = Router();

/** สาธารณะ — รายการสื่อที่เปิดใช้งาน (หน้าแรก / หน้านิสิต) */
router.get("/", listPublicSiteMedia);

export default router;
