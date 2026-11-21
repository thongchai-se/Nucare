import { Role } from "@prisma/client";
import {
  canStaffChatWithStudentResolved,
  canStudentChatWithStaffResolved,
} from "../care-chat-access";
import { getAssignedRoles, hasAssignedRole } from "../roles";
import {
  EPHEMERAL_CHAT_STAFF_ROLES,
  type EphemeralChatStaffRole,
} from "./constants";

export type ChatRoleBearer = {
  role: Role;
  additionalRoles?: readonly Role[] | null;
  roles?: readonly Role[] | null;
  isActive?: boolean;
};

/** รวมบทบาทจาก JWT (roles) หรือจาก role+additionalRoles ในฐานข้อมูล */
function resolveAssignedRoles(user: ChatRoleBearer): Role[] {
  if (user.roles?.length) {
    return [...user.roles];
  }
  return getAssignedRoles({
    role: user.role,
    additionalRoles: user.additionalRoles,
  });
}

/** ตรวจว่าเป็นบทบาทบุคลากรที่แชทชั่วคราวได้ */
export function isEphemeralChatStaffRole(role: Role): role is EphemeralChatStaffRole {
  return (EPHEMERAL_CHAT_STAFF_ROLES as readonly Role[]).includes(role);
}

/** ดึงบทบาทแชทที่เป็นไปได้จากผู้ใช้ (อาจมีหลายบทบาท) */
export function listEphemeralChatStaffRoles(
  user: ChatRoleBearer | null | undefined
): EphemeralChatStaffRole[] {
  if (!user) {
    return [];
  }

  const assigned = new Set(resolveAssignedRoles(user));
  return EPHEMERAL_CHAT_STAFF_ROLES.filter((role) => assigned.has(role));
}

/** บุคลากรที่แชทได้ต้องมีบทบาทที่อนุญาตและบัญชียังใช้งาน */
export function isEligibleChatStaff(user: ChatRoleBearer | null | undefined): boolean {
  if (!user || user.isActive === false) {
    return false;
  }
  return listEphemeralChatStaffRoles(user).length > 0;
}

/** นิสิตต้องเป็นบทบาท STUDENT และบัญชียังใช้งาน */
export function isEligibleChatStudent(user: ChatRoleBearer | null | undefined): boolean {
  if (!user || user.isActive === false) {
    return false;
  }
  return (
    resolveAssignedRoles(user).includes(Role.STUDENT) || hasAssignedRole(user, Role.STUDENT)
  );
}

/**
 * อนุญาตให้นิสิตเปิดแชทกับบุคลากรตามบทบาท
 * — SD: เฉพาะเมื่อมีเคสสวัสดิการเปิดอยู่
 * — MH: เฉพาะ clinician ที่รับเคส counseling ของนิสิต
 * — ADVISOR: เฉพาะในรายชื่อ assignment
 */
export function canStudentChatWithStaff(input: {
  student: ChatRoleBearer | null | undefined;
  staff: (ChatRoleBearer & { id: string }) | null | undefined;
  assignedAdvisorIds?: ReadonlySet<string> | readonly string[] | null;
  ownedClinicianIds?: ReadonlySet<string> | readonly string[] | null;
  hasOpenStudentDevelopmentCase?: boolean;
}): boolean {
  if (!isEligibleChatStudent(input.student) || !isEligibleChatStaff(input.staff) || !input.staff) {
    return false;
  }

  const staffRoles = listEphemeralChatStaffRoles(input.staff);
  return canStudentChatWithStaffResolved({
    staffRoles,
    staffId: input.staff.id,
    assignedAdvisorIds: input.assignedAdvisorIds ?? [],
    ownedClinicianIds: input.ownedClinicianIds ?? [],
    hasOpenStudentDevelopmentCase: Boolean(input.hasOpenStudentDevelopmentCase),
  });
}

/**
 * บุคลากรเริ่มคุยกับนิสิตได้เมื่อผ่านความสัมพันธ์ตามบทบาท
 * — กองพัฒ: เคสสวัสดิการเปิด · ที่ปรึกษา: สังกัด · ผู้เชี่ยวชาญ: เคสที่รับ
 */
export function canStaffStartChatWithStudent(input: {
  staff: ChatRoleBearer | null | undefined;
  student: ChatRoleBearer | null | undefined;
  isAdvisee?: boolean;
  isOwnedCounselingCase?: boolean;
  hasOpenStudentDevelopmentCase?: boolean;
}): boolean {
  if (!isEligibleChatStaff(input.staff) || !isEligibleChatStudent(input.student)) {
    return false;
  }

  return canStaffChatWithStudentResolved({
    staffRoles: listEphemeralChatStaffRoles(input.staff!),
    isAdvisee: Boolean(input.isAdvisee),
    isOwnedCounselingCase: Boolean(input.isOwnedCounselingCase),
    hasOpenStudentDevelopmentCase: Boolean(input.hasOpenStudentDevelopmentCase),
  });
}

/** ผู้ใช้เป็นคู่สนทนาของห้องนี้หรือไม่ (กัน IDOR) */
export function isSessionParticipant(
  userId: string,
  session: { studentId: string; staffId: string }
): boolean {
  return userId === session.studentId || userId === session.staffId;
}

/** ฝั่งตรงข้ามของห้องสำหรับแจ้งเตือน */
export function getSessionPeerUserId(
  userId: string,
  session: { studentId: string; staffId: string }
): string | null {
  if (userId === session.studentId) {
    return session.staffId;
  }
  if (userId === session.staffId) {
    return session.studentId;
  }
  return null;
}
