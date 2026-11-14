import { Role, SiteMediaSlot } from "@prisma/client";
import { hasAssignedRole } from "./roles";

const ALL_SLOTS: SiteMediaSlot[] = [
  SiteMediaSlot.HOME_HERO,
  SiteMediaSlot.HOME_GALLERY,
  SiteMediaSlot.HOME_VIDEO,
  SiteMediaSlot.STUDENT_ACTIVITY,
];

type RoleActor =
  | Role
  | readonly Role[]
  | {
      role: Role;
      roles?: readonly Role[] | null;
    }
  | undefined;

/** ช่องสื่อที่บทบาทนี้จัดการได้ — deny by default */
export function getManageableSiteMediaSlots(actor: RoleActor): SiteMediaSlot[] {
  if (hasAssignedRole(actor, Role.ADMIN)) {
    return [...ALL_SLOTS];
  }
  if (hasAssignedRole(actor, Role.STUDENT_DEVELOPMENT)) {
    return [SiteMediaSlot.STUDENT_ACTIVITY];
  }
  return [];
}

/** ตรวจว่าบทบาทนี้แก้ช่องสื่อที่ระบุได้หรือไม่ */
export function canManageSiteMediaSlot(actor: RoleActor, slot: SiteMediaSlot): boolean {
  return getManageableSiteMediaSlots(actor).includes(slot);
}
