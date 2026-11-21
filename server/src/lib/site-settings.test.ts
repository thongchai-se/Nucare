import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SiteSettings } from "@prisma/client";
import {
  SITE_SETTINGS_DEFAULTS,
  buildSiteSettingsUpdateData,
  deriveFacultyEnglishFullName,
  directoryHostFromUrl,
  isMaintenanceExemptPath,
  shouldBlockForMaintenance,
  toPublicSiteSettingsDto,
} from "./site-settings";
import { patchSiteSettingsSchema } from "../validators/site-settings";

const sampleRow = (overrides: Partial<SiteSettings> = {}): SiteSettings =>
  ({
    id: "default",
    maintenanceEnabled: false,
    maintenanceMessage: "",
    facultyNameTh: SITE_SETTINGS_DEFAULTS.facultyNameTh,
    universityNameTh: SITE_SETTINGS_DEFAULTS.universityNameTh,
    facultyEnglishBanner: SITE_SETTINGS_DEFAULTS.facultyEnglishBanner,
    contactAddress: SITE_SETTINGS_DEFAULTS.contactAddress,
    contactPhoneDisplay: SITE_SETTINGS_DEFAULTS.contactPhoneDisplay,
    contactPhoneTel: SITE_SETTINGS_DEFAULTS.contactPhoneTel,
    contactFaxDisplay: SITE_SETTINGS_DEFAULTS.contactFaxDisplay,
    contactOfficeHoursLabel: SITE_SETTINGS_DEFAULTS.contactOfficeHoursLabel,
    contactOfficeHours: SITE_SETTINGS_DEFAULTS.contactOfficeHours,
    updatedByUserId: null,
    createdAt: new Date("2026-11-21T00:00:00.000Z"),
    updatedAt: new Date("2026-11-21T00:00:00.000Z"),
    ...overrides,
  }) as SiteSettings;

describe("site-settings", () => {
  it("SS-01 แปลงแบนเนอร์อังกฤษเป็นชื่อเต็มแบบ Title Case", () => {
    assert.equal(
      deriveFacultyEnglishFullName("FACULTY OF NURSING, KHON KAEN UNIVERSITY"),
      "Faculty Of Nursing, Khon Kaen University"
    );
  });

  it("SS-02 public DTO ไม่มี secrets และมี maintenance", () => {
    const dto = toPublicSiteSettingsDto(
      sampleRow({
        maintenanceEnabled: true,
        maintenanceMessage: "ปิดปรับปรุง",
      })
    );
    assert.equal(dto.maintenanceEnabled, true);
    assert.equal(dto.maintenanceMessage, "ปิดปรับปรุง");
    assert.equal(dto.facultyNameTh, SITE_SETTINGS_DEFAULTS.facultyNameTh);
    assert.equal(typeof dto.updatedAt, "string");
    assert.equal("updatedByUserId" in dto, false);
  });

  it("SS-03 buildSiteSettingsUpdateData คืนเฉพาะฟิลด์ที่เปลี่ยน", () => {
    const current = sampleRow();
    const patch = buildSiteSettingsUpdateData(current, {
      maintenanceEnabled: true,
      facultyNameTh: current.facultyNameTh,
      contactPhoneTel: "043111111",
    });
    assert.deepEqual(patch, {
      maintenanceEnabled: true,
      contactPhoneTel: "043111111",
    });
  });

  it("SS-04 maintenance exempt paths", () => {
    assert.equal(isMaintenanceExemptPath("GET", "/api/health"), true);
    assert.equal(isMaintenanceExemptPath("POST", "/api/auth/login"), true);
    assert.equal(isMaintenanceExemptPath("GET", "/api/site-settings/public"), true);
    assert.equal(isMaintenanceExemptPath("PATCH", "/api/admin/system/settings"), true);
    assert.equal(isMaintenanceExemptPath("GET", "/api/student/dashboard"), false);
  });

  it("SS-05 shouldBlockForMaintenance — แอดมินและ exempt ไม่ถูกบล็อก", () => {
    assert.equal(
      shouldBlockForMaintenance({
        maintenanceEnabled: true,
        isAdmin: true,
        method: "GET",
        path: "/api/student/dashboard",
      }),
      false
    );
    assert.equal(
      shouldBlockForMaintenance({
        maintenanceEnabled: true,
        isAdmin: false,
        method: "GET",
        path: "/api/health",
      }),
      false
    );
    assert.equal(
      shouldBlockForMaintenance({
        maintenanceEnabled: true,
        isAdmin: false,
        method: "GET",
        path: "/api/advisor/students",
      }),
      true
    );
    assert.equal(
      shouldBlockForMaintenance({
        maintenanceEnabled: false,
        isAdmin: false,
        method: "GET",
        path: "/api/advisor/students",
      }),
      false
    );
  });

  it("SS-06 directoryHostFromUrl ตัดเฉพาะ host", () => {
    assert.equal(directoryHostFromUrl("https://dir.example.edu/api/"), "dir.example.edu");
    assert.equal(directoryHostFromUrl("not-a-url"), null);
    assert.equal(directoryHostFromUrl(""), null);
  });

  it("SS-07 Zod ปฏิเสธฟิลด์แปลกและเบอร์โทรไม่ถูกต้อง", () => {
    const badField = patchSiteSettingsSchema.safeParse({ unknown: true });
    assert.equal(badField.success, false);

    const badTel = patchSiteSettingsSchema.safeParse({ contactPhoneTel: "abc" });
    assert.equal(badTel.success, false);

    const ok = patchSiteSettingsSchema.safeParse({
      maintenanceEnabled: true,
      maintenanceMessage: "ปิดชั่วคราว",
      contactPhoneTel: "043-202-407",
    });
    assert.equal(ok.success, true);
  });
});
