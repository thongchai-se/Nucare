import type { SiteSettings } from "@prisma/client";
import { prisma } from "./prisma";

export const SITE_SETTINGS_ID = "default";

/** ค่าเริ่มต้นแบรนด์/ติดต่อคณะ (สอดคล้อง client/src/lib/brand.ts) */
export const SITE_SETTINGS_DEFAULTS = {
  maintenanceEnabled: false,
  maintenanceMessage: "",
  facultyNameTh: "คณะพยาบาลศาสตร์",
  universityNameTh: "มหาวิทยาลัยขอนแก่น",
  facultyEnglishBanner: "FACULTY OF NURSING, KHON KAEN UNIVERSITY",
  contactAddress:
    "คณะพยาบาลศาสตร์ มหาวิทยาลัยขอนแก่น 123 หมู่ 16 ถ.มิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40002",
  contactPhoneDisplay: "043-202-407 และ 043-202-149",
  contactPhoneTel: "043202407",
  contactFaxDisplay: "043-424-809",
  contactOfficeHoursLabel: "วัน-เวลา ปฏิบัติงาน",
  contactOfficeHours: "วันจันทร์ – ศุกร์ เวลา 08.30น. – 16.30น.",
} as const;

export type SiteSettingsPublicDto = {
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  facultyNameTh: string;
  universityNameTh: string;
  facultyEnglishBanner: string;
  facultyEnglishFullName: string;
  contactAddress: string;
  contactPhoneDisplay: string;
  contactPhoneTel: string;
  contactFaxDisplay: string;
  contactOfficeHoursLabel: string;
  contactOfficeHours: string;
  updatedAt: string;
};

export type SiteSettingsAdminDto = SiteSettingsPublicDto & {
  updatedByUserId: string | null;
};

export type SiteSettingsPatchInput = {
  maintenanceEnabled?: boolean;
  maintenanceMessage?: string;
  facultyNameTh?: string;
  universityNameTh?: string;
  facultyEnglishBanner?: string;
  contactAddress?: string;
  contactPhoneDisplay?: string;
  contactPhoneTel?: string;
  contactFaxDisplay?: string;
  contactOfficeHoursLabel?: string;
  contactOfficeHours?: string;
};

/** สร้างชื่ออังกฤษเต็มจากแบนเนอร์ (ตัด comma แล้วเว้นวรรค) */
export function deriveFacultyEnglishFullName(banner: string): string {
  const trimmed = banner.trim();
  if (!trimmed) {
    return "Faculty of Nursing, Khon Kaen University";
  }
  return trimmed
    .split(",")
    .map((part) => {
      const words = part.trim().toLowerCase().split(/\s+/).filter(Boolean);
      return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    })
    .join(", ");
}

/** แปลงแถว SiteSettings เป็น DTO สาธารณะ (ไม่มี secrets) */
export function toPublicSiteSettingsDto(row: SiteSettings): SiteSettingsPublicDto {
  return {
    maintenanceEnabled: row.maintenanceEnabled,
    maintenanceMessage: row.maintenanceMessage,
    facultyNameTh: row.facultyNameTh,
    universityNameTh: row.universityNameTh,
    facultyEnglishBanner: row.facultyEnglishBanner,
    facultyEnglishFullName: deriveFacultyEnglishFullName(row.facultyEnglishBanner),
    contactAddress: row.contactAddress,
    contactPhoneDisplay: row.contactPhoneDisplay,
    contactPhoneTel: row.contactPhoneTel,
    contactFaxDisplay: row.contactFaxDisplay,
    contactOfficeHoursLabel: row.contactOfficeHoursLabel,
    contactOfficeHours: row.contactOfficeHours,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** แปลงแถว SiteSettings เป็น DTO สำหรับแอดมิน */
export function toAdminSiteSettingsDto(row: SiteSettings): SiteSettingsAdminDto {
  return {
    ...toPublicSiteSettingsDto(row),
    updatedByUserId: row.updatedByUserId,
  };
}

/** รวมแพตช์กับค่าเดิม — คืนเฉพาะฟิลด์ที่เปลี่ยนจริง */
export function buildSiteSettingsUpdateData(
  current: SiteSettings,
  patch: SiteSettingsPatchInput
): Partial<SiteSettingsPatchInput> & { updatedByUserId?: string | null } {
  const next: Partial<SiteSettingsPatchInput> = {};

  if (patch.maintenanceEnabled !== undefined && patch.maintenanceEnabled !== current.maintenanceEnabled) {
    next.maintenanceEnabled = patch.maintenanceEnabled;
  }
  if (patch.maintenanceMessage !== undefined && patch.maintenanceMessage !== current.maintenanceMessage) {
    next.maintenanceMessage = patch.maintenanceMessage;
  }
  if (patch.facultyNameTh !== undefined && patch.facultyNameTh !== current.facultyNameTh) {
    next.facultyNameTh = patch.facultyNameTh;
  }
  if (patch.universityNameTh !== undefined && patch.universityNameTh !== current.universityNameTh) {
    next.universityNameTh = patch.universityNameTh;
  }
  if (
    patch.facultyEnglishBanner !== undefined &&
    patch.facultyEnglishBanner !== current.facultyEnglishBanner
  ) {
    next.facultyEnglishBanner = patch.facultyEnglishBanner;
  }
  if (patch.contactAddress !== undefined && patch.contactAddress !== current.contactAddress) {
    next.contactAddress = patch.contactAddress;
  }
  if (
    patch.contactPhoneDisplay !== undefined &&
    patch.contactPhoneDisplay !== current.contactPhoneDisplay
  ) {
    next.contactPhoneDisplay = patch.contactPhoneDisplay;
  }
  if (patch.contactPhoneTel !== undefined && patch.contactPhoneTel !== current.contactPhoneTel) {
    next.contactPhoneTel = patch.contactPhoneTel;
  }
  if (patch.contactFaxDisplay !== undefined && patch.contactFaxDisplay !== current.contactFaxDisplay) {
    next.contactFaxDisplay = patch.contactFaxDisplay;
  }
  if (
    patch.contactOfficeHoursLabel !== undefined &&
    patch.contactOfficeHoursLabel !== current.contactOfficeHoursLabel
  ) {
    next.contactOfficeHoursLabel = patch.contactOfficeHoursLabel;
  }
  if (
    patch.contactOfficeHours !== undefined &&
    patch.contactOfficeHours !== current.contactOfficeHours
  ) {
    next.contactOfficeHours = patch.contactOfficeHours;
  }

  return next;
}

type MaintenanceSnapshot = {
  at: number;
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
};

let maintenanceSnapshotCache: MaintenanceSnapshot | null = null;
const MAINTENANCE_CACHE_MS = 5_000;

/** ล้างแคชโหมดปิดปรับปรุงหลังแอดมินบันทึก */
export function invalidateSiteSettingsCache(): void {
  maintenanceSnapshotCache = null;
}

/** ดึงแถวตั้งค่า — สร้างด้วยค่าเริ่มต้นถ้ายังไม่มี */
export async function getOrCreateSiteSettings(): Promise<SiteSettings> {
  const existing = await prisma.siteSettings.findUnique({
    where: { id: SITE_SETTINGS_ID },
  });
  if (existing) {
    return existing;
  }

  return prisma.siteSettings.create({
    data: {
      id: SITE_SETTINGS_ID,
      ...SITE_SETTINGS_DEFAULTS,
    },
  });
}

/** อ่านสถานะโหมดปิดปรับปรุงแบบแคชสั้น ๆ สำหรับ middleware */
export async function getMaintenanceSnapshot(): Promise<{
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
}> {
  if (
    maintenanceSnapshotCache &&
    Date.now() - maintenanceSnapshotCache.at < MAINTENANCE_CACHE_MS
  ) {
    return {
      maintenanceEnabled: maintenanceSnapshotCache.maintenanceEnabled,
      maintenanceMessage: maintenanceSnapshotCache.maintenanceMessage,
    };
  }

  const row = await getOrCreateSiteSettings();
  maintenanceSnapshotCache = {
    at: Date.now(),
    maintenanceEnabled: row.maintenanceEnabled,
    maintenanceMessage: row.maintenanceMessage,
  };
  return {
    maintenanceEnabled: row.maintenanceEnabled,
    maintenanceMessage: row.maintenanceMessage,
  };
}

/** ตรวจว่า path ของ request ควรข้ามโหมดปิดปรับปรุงหรือไม่ */
export function isMaintenanceExemptPath(method: string, path: string): boolean {
  const normalized = path.replace(/\/+$/, "") || "/";
  const upperMethod = method.toUpperCase();

  if (normalized === "/api/health" || normalized === "/health") {
    return true;
  }
  if (normalized === "/" || normalized === "/api") {
    return true;
  }
  if (normalized.startsWith("/api/auth")) {
    return true;
  }
  if (upperMethod === "GET" && normalized === "/api/site-settings/public") {
    return true;
  }
  // แอดมินต้องอ่าน/ปิดโหมดได้แม้ระบบอยู่ใน maintenance
  if (normalized.startsWith("/api/admin/system")) {
    return true;
  }
  if (normalized.startsWith("/api/admin/external-directory")) {
    return true;
  }

  return false;
}

/** ตัดสินใจบล็อกคำขอเมื่อเปิดโหมดปิดปรับปรุง */
export function shouldBlockForMaintenance(input: {
  maintenanceEnabled: boolean;
  isAdmin: boolean;
  method: string;
  path: string;
}): boolean {
  if (!input.maintenanceEnabled) {
    return false;
  }
  if (input.isAdmin) {
    return false;
  }
  if (isMaintenanceExemptPath(input.method, input.path)) {
    return false;
  }
  return true;
}

/** ดึง hostname จาก URL ของ directory โดยไม่เปิดเผย key */
export function directoryHostFromUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }
  try {
    return new URL(url.trim()).host || null;
  } catch {
    return null;
  }
}
