import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role, SiteMediaSlot } from "@prisma/client";
import { canManageSiteMediaSlot, getManageableSiteMediaSlots } from "./site-media-access";

describe("site-media access", () => {
  it("SMA-01 ADMIN จัดการได้ทุกช่อง", () => {
    const slots = getManageableSiteMediaSlots(Role.ADMIN);
    assert.deepEqual(slots, [
      SiteMediaSlot.HOME_HERO,
      SiteMediaSlot.HOME_GALLERY,
      SiteMediaSlot.STUDENT_ACTIVITY,
    ]);
    assert.equal(canManageSiteMediaSlot(Role.ADMIN, SiteMediaSlot.HOME_HERO), true);
  });

  it("SMA-02 SD จัดการได้เฉพาะกิจกรรมหน้านิสิต", () => {
    const slots = getManageableSiteMediaSlots(Role.STUDENT_DEVELOPMENT);
    assert.deepEqual(slots, [SiteMediaSlot.STUDENT_ACTIVITY]);
    assert.equal(canManageSiteMediaSlot(Role.STUDENT_DEVELOPMENT, SiteMediaSlot.STUDENT_ACTIVITY), true);
    assert.equal(canManageSiteMediaSlot(Role.STUDENT_DEVELOPMENT, SiteMediaSlot.HOME_HERO), false);
    assert.equal(canManageSiteMediaSlot(Role.STUDENT_DEVELOPMENT, SiteMediaSlot.HOME_GALLERY), false);
  });

  it("SMA-03 บทบาทอื่นจัดการไม่ได้", () => {
    assert.deepEqual(getManageableSiteMediaSlots(Role.ADVISOR), []);
    assert.deepEqual(getManageableSiteMediaSlots(Role.STUDENT), []);
    assert.equal(canManageSiteMediaSlot(Role.MENTAL_HEALTH, SiteMediaSlot.STUDENT_ACTIVITY), false);
  });
});
