import {
  ReferralStatus,
  ReferralTarget,
  type PrismaClient,
} from "@prisma/client";

export type MentalHealthAccessLevel = "none" | "triage" | "clinical";

export type MentalHealthAccessDb = Pick<PrismaClient, "caseReferral">;

export type MentalHealthStudentAccessStore = {
  /** ระดับสิทธิ์ MH ต่อนิสิต: clinical / triage / none */
  resolveMentalHealthStudentAccess: (
    staffId: string,
    studentId: string
  ) => Promise<MentalHealthAccessLevel>;
  /** รายการนิสิตที่ MH คนนี้เข้าถึงได้ (คิว PENDING ที่ยังไม่ปฏิเสธ + เคส ACCEPTED ที่ตนรับ) */
  listMentalHealthStudentIds: (staffId: string) => Promise<string[]>;
};

type OpenCounselingRow = {
  id: string;
  status: ReferralStatus;
  acceptedByUserId: string | null;
  declines: Array<{ userId: string }>;
};

/** เคส ACCEPTED ที่ผู้เรียกเป็นผู้รับ — ใช้กรองรายการ “เคสที่ดูแล” */
export function isOwnedAcceptedCase(input: {
  status: ReferralStatus;
  acceptedByUserId: string | null | undefined;
  actorUserId: string;
}): boolean {
  return (
    input.status === ReferralStatus.ACCEPTED && input.acceptedByUserId === input.actorUserId
  );
}

/** คำนวณระดับสิทธิ์จากแถว referral ที่โหลดมาแล้ว (pure) — O(n) ตามจำนวนแถว */
export function resolveMentalHealthAccessFromReferrals(
  actorUserId: string,
  rows: readonly OpenCounselingRow[]
): MentalHealthAccessLevel {
  let triage = false;
  for (const row of rows) {
    if (
      row.status === ReferralStatus.ACCEPTED &&
      row.acceptedByUserId === actorUserId
    ) {
      return "clinical";
    }
    if (
      row.status === ReferralStatus.PENDING &&
      !row.declines.some((decline) => decline.userId === actorUserId)
    ) {
      triage = true;
    }
  }
  return triage ? "triage" : "none";
}

/** โหลดคิว counseling ที่ยังเปิดแล้วคืนระดับสิทธิ์ของผู้เชี่ยวชาญต่อนิสิตรายคน */
export async function resolveMentalHealthStudentAccess(
  db: MentalHealthAccessDb,
  actorUserId: string,
  studentId: string
): Promise<MentalHealthAccessLevel> {
  const rows = await db.caseReferral.findMany({
    where: {
      studentId,
      target: ReferralTarget.COUNSELING_CENTER,
      status: { in: [ReferralStatus.PENDING, ReferralStatus.ACCEPTED] },
    },
    select: {
      id: true,
      status: true,
      acceptedByUserId: true,
      declines: {
        where: { userId: actorUserId },
        select: { userId: true },
        take: 1,
      },
    },
    take: 20,
  });
  return resolveMentalHealthAccessFromReferrals(actorUserId, rows);
}

/** รายการ studentId ที่ MH เข้าถึงได้ — ใช้จำกัด scope รายชื่อ */
export async function listMentalHealthAccessibleStudentIds(
  db: MentalHealthAccessDb,
  staffId: string
): Promise<string[]> {
  const rows = await db.caseReferral.findMany({
    where: {
      target: ReferralTarget.COUNSELING_CENTER,
      OR: [
        {
          status: ReferralStatus.ACCEPTED,
          acceptedByUserId: staffId,
        },
        {
          status: ReferralStatus.PENDING,
          declines: { none: { userId: staffId } },
        },
      ],
    },
    select: { studentId: true },
    take: 2000,
  });
  const ids = new Set<string>();
  for (const row of rows) {
    ids.add(row.studentId);
  }
  return [...ids];
}

export type DashboardCareSessionInput = {
  id: string;
  sessionDate: Date | string;
  summary: string;
  interventionPlan: string;
  providerName: string;
  createdAt: Date | string;
};

/**
 * กรองเนื้อหาคลินิกบน dashboard ตามความเป็นเจ้าของเคส
 * — คิว PENDING / เคสคนอื่น: ไม่ส่ง summary/interventionPlan
 * — ผู้รับเคส (acceptedBy = ตน): ส่งเต็ม ทั้ง ACCEPTED และ CLOSED
 */
export function scopeMentalHealthDashboardCareSessions(input: {
  referralStatus: ReferralStatus;
  acceptedByUserId: string | null | undefined;
  actorUserId: string;
  sessions: readonly DashboardCareSessionInput[];
}): DashboardCareSessionInput[] {
  void input.referralStatus;
  if (input.acceptedByUserId !== input.actorUserId) {
    return [];
  }
  return [...input.sessions];
}

/** ตัดเนื้อหาคลินิกจากเซสชันดูแลเมื่ออยู่โหมด triage */
export function redactClinicalCareSessionFields<
  T extends { summary: string; interventionPlan: string; confidentialNotes?: string | null },
>(sessions: T[]): Array<T & { summary: string; interventionPlan: string; confidentialNotes: null }> {
  return sessions.map((session) => ({
    ...session,
    summary: "",
    interventionPlan: "",
    confidentialNotes: null,
  }));
}

/** store เริ่มต้นที่ผูก Prisma — ใช้จาก access-control */
export function createDefaultMentalHealthAccessStore(
  db: MentalHealthAccessDb
): MentalHealthStudentAccessStore {
  return {
    resolveMentalHealthStudentAccess: (staffId, studentId) =>
      resolveMentalHealthStudentAccess(db, staffId, studentId),
    listMentalHealthStudentIds: (staffId) =>
      listMentalHealthAccessibleStudentIds(db, staffId),
  };
}
