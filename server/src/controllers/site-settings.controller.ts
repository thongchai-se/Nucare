import { Role } from "@prisma/client";
import { Request, Response } from "express";
import { getRequestIpAddress, writeAuditLog } from "../lib/audit-log";
import { readEnv } from "../lib/env";
import { prisma } from "../lib/prisma";
import { hasAssignedRole } from "../lib/roles";
import {
  SITE_SETTINGS_ID,
  buildSiteSettingsUpdateData,
  directoryHostFromUrl,
  getOrCreateSiteSettings,
  invalidateSiteSettingsCache,
  toAdminSiteSettingsDto,
  toPublicSiteSettingsDto,
} from "../lib/site-settings";
import { patchSiteSettingsSchema } from "../validators/site-settings";

/** คืนค่าตั้งค่าสาธารณะสำหรับ footer / โหมดปิดปรับปรุง */
export const getPublicSiteSettings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const row = await getOrCreateSiteSettings();
    res.status(200).json(toPublicSiteSettingsDto(row));
  } catch (error) {
    console.error("Get public site settings error:", error);
    res.status(500).json({ message: "โหลดการตั้งค่าไซต์ไม่สำเร็จ" });
  }
};

/** คืนค่าตั้งค่าเต็มสำหรับแอดมิน */
export const getAdminSiteSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !hasAssignedRole(req.user, Role.ADMIN)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    const row = await getOrCreateSiteSettings();
    res.status(200).json(toAdminSiteSettingsDto(row));
  } catch (error) {
    console.error("Get admin site settings error:", error);
    res.status(500).json({ message: "โหลดการตั้งค่าระบบไม่สำเร็จ" });
  }
};

/** อัปเดตโหมดปิดปรับปรุงและข้อมูลคณะ — บันทึก audit */
export const patchAdminSiteSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !hasAssignedRole(req.user, Role.ADMIN)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    const parsed = patchSiteSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง", errors: parsed.error.flatten() });
      return;
    }

    const current = await getOrCreateSiteSettings();
    const updateData = buildSiteSettingsUpdateData(current, parsed.data);
    if (Object.keys(updateData).length === 0) {
      res.status(200).json(toAdminSiteSettingsDto(current));
      return;
    }

    const updated = await prisma.siteSettings.update({
      where: { id: SITE_SETTINGS_ID },
      data: {
        ...updateData,
        updatedByUserId: req.user.userId,
      },
    });
    invalidateSiteSettingsCache();

    const toggledMaintenance =
      parsed.data.maintenanceEnabled !== undefined &&
      parsed.data.maintenanceEnabled !== current.maintenanceEnabled;

    const changedFields = Object.keys(updateData).join(", ");
    await writeAuditLog({
      action: toggledMaintenance ? "admin.maintenance.toggle" : "admin.site-settings.update",
      actorUserId: req.user.userId,
      entityType: "SiteSettings",
      entityId: SITE_SETTINGS_ID,
      description: toggledMaintenance
        ? parsed.data.maintenanceEnabled
          ? "เปิดโหมดปิดปรับปรุงระบบ"
          : "ปิดโหมดปิดปรับปรุงระบบ"
        : `อัปเดตการตั้งค่าระบบ/ข้อมูลคณะ (${changedFields})`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(200).json(toAdminSiteSettingsDto(updated));
  } catch (error) {
    console.error("Patch admin site settings error:", error);
    res.status(500).json({ message: "บันทึกการตั้งค่าระบบไม่สำเร็จ" });
  }
};

/** สุขภาพระบบสำหรับแอดมิน — ไม่เปิดเผย secrets */
export const getAdminSystemHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || !hasAssignedRole(req.user, Role.ADMIN)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }

    let databaseOk = false;
    let latencyMs: number | null = null;
    const started = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      latencyMs = Date.now() - started;
      databaseOk = true;
    } catch {
      latencyMs = Date.now() - started;
      databaseOk = false;
    }

    const directoryUrl = readEnv("DIRECTORY_API_URL");
    const directoryKey = readEnv("DIRECTORY_API_KEY");
    const directoryConfigured = Boolean(directoryUrl?.trim() && directoryKey?.trim());

    res.status(200).json({
      ok: databaseOk,
      api: { ok: true },
      database: { ok: databaseOk, latencyMs },
      directory: {
        configured: directoryConfigured,
        host: directoryHostFromUrl(directoryUrl),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Get admin system health error:", error);
    res.status(500).json({ message: "ตรวจสอบสถานะระบบไม่สำเร็จ" });
  }
};
