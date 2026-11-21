import { ReferralStatus, ReferralTarget, Role, type PrismaClient } from "@prisma/client";
import {
  canAccessStudent,
  type StudentAccessStore,
} from "./access-control";
import { prisma as defaultPrisma } from "./prisma";
import { getAssignedRoles, hasAssignedRole } from "./roles";

export type CareChatDb = Pick<
  PrismaClient,
  "caseReferral" | "studentAdvisorAssignment" | "studentInstructorAssignment"
>;

export type RoleBearer = {
  role: Role;
  additionalRoles?: readonly Role[] | null;
  roles?: readonly Role[] | null;
};

const resolveRoles = (bearer: RoleBearer | Role | Role[]): Role[] => {
  if (Array.isArray(bearer)) {
    return bearer;
  }
  if (typeof bearer === "string") {
    return [bearer];
  }
  if (bearer.roles?.length) {
    return [...bearer.roles];
  }
  return getAssignedRoles({
    role: bearer.role,
    additionalRoles: bearer.additionalRoles,
  });
};

/** มีเคส counseling ที่ ACCEPTED และผู้เรียกเป็นผู้รับเคส */
export async function hasOwnedAcceptedCounselingCase(
  db: CareChatDb,
  staffId: string,
  studentId: string
): Promise<boolean> {
  const owned = await db.caseReferral.findFirst({
    where: {
      studentId,
      target: ReferralTarget.COUNSELING_CENTER,
      status: ReferralStatus.ACCEPTED,
      acceptedByUserId: staffId,
    },
    select: { id: true },
  });
  return Boolean(owned);
}

/** มีเคสสวัสดิการงานพัฒนานิสิตที่ยังเปิดอยู่ (PENDING/ACCEPTED) */
export async function hasOpenStudentDevelopmentCase(
  db: CareChatDb,
  studentId: string
): Promise<boolean> {
  const open = await db.caseReferral.findFirst({
    where: {
      studentId,
      target: ReferralTarget.STUDENT_DEVELOPMENT,
      status: { in: [ReferralStatus.PENDING, ReferralStatus.ACCEPTED] },
    },
    select: { id: true },
  });
  return Boolean(open);
}

/** รายการ id ผู้เชี่ยวชาญที่รับเคส counseling ของนิสิตแล้ว */
export async function listOwnedCounselingClinicianIdsForStudent(
  db: CareChatDb,
  studentId: string
): Promise<string[]> {
  const rows = await db.caseReferral.findMany({
    where: {
      studentId,
      target: ReferralTarget.COUNSELING_CENTER,
      status: ReferralStatus.ACCEPTED,
      acceptedByUserId: { not: null },
    },
    select: { acceptedByUserId: true },
  });
  const ids = new Set<string>();
  for (const row of rows) {
    if (row.acceptedByUserId) {
      ids.add(row.acceptedByUserId);
    }
  }
  return [...ids];
}

/**
 * สิทธิ์ดูประวัติบันทึกดูแล
 * — EXEC/ADMIN: ทุกคน
 * — ADVISOR: นิสิตในสังกัด
 * — MH: เฉพาะเคส counseling ที่ตนรับแล้ว
 * — SD อย่างเดียว: ไม่เห็น
 */
export async function canViewCareHistory(
  role: Role | Role[] | RoleBearer,
  actorId: string,
  studentId: string,
  db: CareChatDb,
  store?: StudentAccessStore
): Promise<boolean> {
  const roles = resolveRoles(role);

  if (hasAssignedRole(roles, Role.ADMIN) || hasAssignedRole(roles, Role.EXECUTIVE)) {
    return true;
  }

  if (hasAssignedRole(roles, Role.ADVISOR)) {
    if (await canAccessStudent(Role.ADVISOR, actorId, studentId, store)) {
      return true;
    }
  }

  if (hasAssignedRole(roles, Role.MENTAL_HEALTH)) {
    if (await hasOwnedAcceptedCounselingCase(db, actorId, studentId)) {
      return true;
    }
  }

  return false;
}

/** ระดับเนื้อหาบันทึกดูแลที่อนุญาต */
export type CareHistoryContentLevel = "none" | "operational" | "clinical";

/** คืนระดับเนื้อหา: clinical = มี confidential ได้, operational = summary/plan เท่านั้น */
export function resolveCareHistoryContentLevel(
  role: Role | Role[] | RoleBearer
): CareHistoryContentLevel {
  const roles = resolveRoles(role);
  if (hasAssignedRole(roles, Role.MENTAL_HEALTH)) {
    return "clinical";
  }
  if (
    hasAssignedRole(roles, Role.ADMIN) ||
    hasAssignedRole(roles, Role.EXECUTIVE) ||
    hasAssignedRole(roles, Role.ADVISOR)
  ) {
    return "operational";
  }
  return "none";
}

/**
 * ตรวจสิทธิ์บุคลากรเปิดแชทกับนิสิตจากชุด flag ที่โหลดมาแล้ว (pure)
 * — ADMIN / EXECUTIVE: ไม่แชทนิสิตโดยตรง
 * — กองพัฒนานิสิต: เฉพาะนิสิตที่มีเคสสวัสดิการเปิดอยู่
 * — ที่ปรึกษา: เฉพาะนิสิตในสังกัด
 * — ผู้เชี่ยวชาญสุขภาพจิต: เฉพาะเคส counseling ที่ตนรับแล้ว
 */
export function canStaffChatWithStudentResolved(input: {
  staffRoles: readonly Role[];
  isAdvisee: boolean;
  isOwnedCounselingCase: boolean;
  hasOpenStudentDevelopmentCase?: boolean;
  /** @deprecated ไม่ใช้ขยายสิทธิ์แชทแล้ว — คงไว้เพื่อเข้ากันกับ caller เดิม */
  isInstructorStudent?: boolean;
}): boolean {
  const roles = input.staffRoles;
  if (hasAssignedRole(roles, Role.ADMIN) || hasAssignedRole(roles, Role.EXECUTIVE)) {
    // ยังอนุญาตผ่านบทบาทอื่นที่ผูกความสัมพันธ์ (เช่น multi-role เป็นที่ปรึกษา)
  }
  if (hasAssignedRole(roles, Role.ADVISOR) && input.isAdvisee) {
    return true;
  }
  if (hasAssignedRole(roles, Role.MENTAL_HEALTH) && input.isOwnedCounselingCase) {
    return true;
  }
  if (hasAssignedRole(roles, Role.STUDENT_DEVELOPMENT) && input.hasOpenStudentDevelopmentCase) {
    return true;
  }
  return false;
}

/**
 * ตรวจสิทธิ์นิสิตเปิดแชทกับบุคลากรจากชุด flag (pure)
 * — ไม่ใช้ shortcut กว้างของ EXEC/SD/ADMIN
 */
export function canStudentChatWithStaffResolved(input: {
  staffRoles: readonly Role[];
  staffId: string;
  assignedAdvisorIds: ReadonlySet<string> | readonly string[];
  ownedClinicianIds: ReadonlySet<string> | readonly string[];
  hasOpenStudentDevelopmentCase?: boolean;
}): boolean {
  const roles = input.staffRoles;
  const advisorSet =
    input.assignedAdvisorIds instanceof Set
      ? input.assignedAdvisorIds
      : new Set(input.assignedAdvisorIds);
  const clinicianSet =
    input.ownedClinicianIds instanceof Set
      ? input.ownedClinicianIds
      : new Set(input.ownedClinicianIds);

  if (hasAssignedRole(roles, Role.MENTAL_HEALTH) && clinicianSet.has(input.staffId)) {
    return true;
  }
  if (hasAssignedRole(roles, Role.ADVISOR) && advisorSet.has(input.staffId)) {
    return true;
  }
  if (hasAssignedRole(roles, Role.STUDENT_DEVELOPMENT) && input.hasOpenStudentDevelopmentCase) {
    return true;
  }
  return false;
}

/** โหลด flag แล้วตัดสินว่า staff คุยกับนิสิตรายนี้ได้หรือไม่ */
export async function canStaffChatWithStudent(
  db: CareChatDb,
  staff: RoleBearer & { id: string },
  studentId: string,
  store?: StudentAccessStore
): Promise<boolean> {
  const roles = resolveRoles(staff);
  const needsAdvisee = hasAssignedRole(roles, Role.ADVISOR);
  const needsMh = hasAssignedRole(roles, Role.MENTAL_HEALTH);
  const needsSdCase = hasAssignedRole(roles, Role.STUDENT_DEVELOPMENT);

  const [isAdvisee, isOwnedCounselingCase, hasOpenSdCase] = await Promise.all([
    needsAdvisee ? canAccessStudent(Role.ADVISOR, staff.id, studentId, store) : Promise.resolve(false),
    needsMh ? hasOwnedAcceptedCounselingCase(db, staff.id, studentId) : Promise.resolve(false),
    needsSdCase ? hasOpenStudentDevelopmentCase(db, studentId) : Promise.resolve(false),
  ]);

  return canStaffChatWithStudentResolved({
    staffRoles: roles,
    isAdvisee,
    isOwnedCounselingCase,
    hasOpenStudentDevelopmentCase: hasOpenSdCase,
  });
}

export type ChatableStudentScope = { mode: "all" } | { mode: "ids"; studentIds: string[] };

const defaultListAdvisorStudentIds = async (advisorId: string): Promise<string[]> => {
  const rows = await defaultPrisma.studentAdvisorAssignment.findMany({
    where: { advisorId, isActive: true },
    select: { studentId: true },
  });
  return rows.map((row) => row.studentId);
};

/**
 * ขอบเขตนิสิตที่บุคลากรค้นหา/ทักแชทได้
 * — ADMIN / EXECUTIVE อย่างเดียว: ไม่มีรายการ (ids ว่าง) — ไม่ทักนิสิตทั้งคณะ
 * — กองพัฒนานิสิต: เฉพาะนิสิตที่มีเคสสวัสดิการเปิดอยู่
 * — ที่ปรึกษา: เฉพาะนิสิตในสังกัด
 * — ผู้เชี่ยวชาญ: เฉพาะเคส counseling ที่ตนรับแล้ว
 * — มีหลายบทบาท: รวมสิทธิ์แบบ union ตามความสัมพันธ์จริง
 */
export async function resolveStaffChatableStudentScope(
  db: CareChatDb,
  staff: RoleBearer & { id: string },
  store?: Pick<StudentAccessStore, "listAdvisorStudentIds">
): Promise<ChatableStudentScope> {
  const roles = resolveRoles(staff);
  const listAdvisor = store?.listAdvisorStudentIds ?? defaultListAdvisorStudentIds;
  const ids = new Set<string>();

  if (hasAssignedRole(roles, Role.ADVISOR)) {
    for (const id of await listAdvisor(staff.id)) {
      ids.add(id);
    }
  }
  if (hasAssignedRole(roles, Role.MENTAL_HEALTH)) {
    const referrals = await db.caseReferral.findMany({
      where: {
        target: ReferralTarget.COUNSELING_CENTER,
        status: ReferralStatus.ACCEPTED,
        acceptedByUserId: staff.id,
      },
      select: { studentId: true },
    });
    for (const row of referrals) {
      ids.add(row.studentId);
    }
  }
  if (hasAssignedRole(roles, Role.STUDENT_DEVELOPMENT)) {
    const welfare = await db.caseReferral.findMany({
      where: {
        target: ReferralTarget.STUDENT_DEVELOPMENT,
        status: { in: [ReferralStatus.PENDING, ReferralStatus.ACCEPTED] },
      },
      select: { studentId: true },
    });
    for (const row of welfare) {
      ids.add(row.studentId);
    }
  }

  return { mode: "ids", studentIds: [...ids] };
}
