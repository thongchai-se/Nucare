import {
  EphemeralChatSessionStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { ACTIVE_CONSULTATION_STATUSES } from "../active-consultation";
import {
  canStaffChatWithStudent,
  hasOpenStudentDevelopmentCase,
  listOwnedCounselingClinicianIdsForStudent,
} from "../care-chat-access";
import {
  EPHEMERAL_CHAT_MAX_MESSAGES,
  EPHEMERAL_CHAT_PRESSURE_TARGET_RATIO,
} from "./constants";
import {
  canStudentChatWithStaff,
  isEligibleChatStaff,
  isEligibleChatStudent,
  isSessionParticipant,
} from "./eligibility";

export type EphemeralChatDb = Prisma.TransactionClient | typeof import("../prisma").prisma;

export type SessionPeerUser = {
  id: string;
  name: string;
  studentId: string | null;
  employeeId: string | null;
  image: string | null;
  role: Role;
  additionalRoles: Role[];
};

export type EphemeralChatSessionRecord = {
  id: string;
  studentId: string;
  staffId: string;
  status: EphemeralChatSessionStatus;
  consultationRequestId: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  student: SessionPeerUser;
  staff: SessionPeerUser;
};

const sessionInclude = {
  student: {
    select: {
      id: true,
      name: true,
      studentId: true,
      employeeId: true,
      image: true,
      role: true,
      additionalRoles: true,
    },
  },
  staff: {
    select: {
      id: true,
      name: true,
      studentId: true,
      employeeId: true,
      image: true,
      role: true,
      additionalRoles: true,
    },
  },
} satisfies Prisma.EphemeralChatSessionInclude;

/** หาคำขอปรึกษาที่ยังเปิดอยู่ของคู่นิสิต–อาจารย์ */
export async function findOpenConsultationForPair(
  db: EphemeralChatDb,
  studentId: string,
  staffId: string
): Promise<{ id: string } | null> {
  return db.consultationRequest.findFirst({
    where: {
      studentId,
      teacherId: staffId,
      status: { in: ACTIVE_CONSULTATION_STATUSES },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });
}

/** โหลด id ที่ปรึกษาที่นิสิตคุยได้ — เฉพาะ assignment ที่ยังใช้งาน */
export async function loadEligibleAdvisorIdsForStudent(
  db: EphemeralChatDb,
  studentId: string
): Promise<Set<string>> {
  const assignments = await db.studentAdvisorAssignment.findMany({
    where: { studentId, isActive: true },
    select: { advisorId: true },
  });

  const ids = new Set<string>();
  for (const row of assignments) {
    ids.add(row.advisorId);
  }
  return ids;
}

/** โหลด id ผู้เชี่ยวชาญที่รับเคส counseling ของนิสิตแล้ว */
export async function loadOwnedCounselingClinicianIdsForStudent(
  db: EphemeralChatDb,
  studentId: string
): Promise<Set<string>> {
  const ids = await listOwnedCounselingClinicianIdsForStudent(db, studentId);
  return new Set(ids);
}

/** ตรวจสิทธิ์นิสิตเปิดแชทกับ staffId */
export async function assertStudentMayOpenChatWithStaff(
  db: EphemeralChatDb,
  student: { id: string; role: Role; additionalRoles?: Role[]; isActive?: boolean },
  staffId: string
): Promise<{ staff: SessionPeerUser }> {
  const staff = await db.user.findFirst({
    where: { id: staffId, isActive: true },
    select: {
      id: true,
      name: true,
      studentId: true,
      employeeId: true,
      image: true,
      role: true,
      additionalRoles: true,
      isActive: true,
    },
  });

  if (!staff || !isEligibleChatStaff(staff)) {
    throw Object.assign(new Error("ไม่พบบุคลากรที่เลือก หรือไม่สามารถแชทได้"), {
      status: 404,
      code: "CHAT_PEER_NOT_FOUND",
    });
  }

  const [assignedAdvisorIds, ownedClinicianIds, hasOpenSdCase] = await Promise.all([
    loadEligibleAdvisorIdsForStudent(db, student.id),
    loadOwnedCounselingClinicianIdsForStudent(db, student.id),
    hasOpenStudentDevelopmentCase(db, student.id),
  ]);
  if (
    !canStudentChatWithStaff({
      student,
      staff,
      assignedAdvisorIds,
      ownedClinicianIds,
      hasOpenStudentDevelopmentCase: hasOpenSdCase,
    })
  ) {
    throw Object.assign(new Error("ไม่มีสิทธิ์เปิดแชทกับบุคลากรคนนี้"), {
      status: 403,
      code: "CHAT_NOT_ALLOWED",
    });
  }

  return { staff };
}

/**
 * บุคลากรที่แชทได้เริ่มคุยกับนิสิตที่ใช้งานอยู่ได้เลย (สอบถาม/ติดต่อโดยไม่ต้องรอให้นิสิตทักก่อน)
 */
export async function assertStaffMayOpenChatWithStudent(
  db: EphemeralChatDb,
  staff: { id: string; role: Role; additionalRoles?: Role[]; roles?: Role[]; isActive?: boolean },
  studentId: string
): Promise<{ student: SessionPeerUser }> {
  if (!isEligibleChatStaff(staff)) {
    throw Object.assign(new Error("บัญชีนี้ไม่สามารถใช้แชทบุคลากรได้"), {
      status: 403,
      code: "CHAT_NOT_ALLOWED",
    });
  }

  const student = await db.user.findFirst({
    where: { id: studentId, isActive: true, role: Role.STUDENT },
    select: {
      id: true,
      name: true,
      studentId: true,
      employeeId: true,
      image: true,
      role: true,
      additionalRoles: true,
      isActive: true,
    },
  });

  if (!student) {
    throw Object.assign(new Error("ไม่พบนิสิตที่เลือก"), {
      status: 404,
      code: "CHAT_PEER_NOT_FOUND",
    });
  }

  const allowed = await canStaffChatWithStudent(db, staff, student.id);
  if (!allowed) {
    throw Object.assign(new Error("ไม่มีสิทธิ์เปิดแชทกับนิสิตคนนี้"), {
      status: 403,
      code: "CHAT_NOT_ALLOWED",
    });
  }

  return { student };
}

/**
 * เงื่อนไขรายชื่อนิสิตในไดเรกทอรีข้อความ — ว่างก็ได้ (โชว์ทั้งหมดในขอบเขต)
 * คำค้นเป็นตัวเลือก กรองชื่อ/รหัสเมื่อมีข้อความ · studyYear กรองชั้นปีเมื่อระบุ
 */
export function buildStudentChatPeerListWhere(
  rawQuery: string,
  scope?: { mode: "all" } | { mode: "ids"; studentIds: string[] },
  studyYear?: number | null
): Prisma.UserWhereInput | null {
  if (scope?.mode === "ids" && scope.studentIds.length === 0) {
    return null;
  }
  const q = rawQuery.trim().slice(0, 80);
  const year =
    typeof studyYear === "number" && Number.isInteger(studyYear) && studyYear > 0
      ? studyYear
      : null;
  return {
    isActive: true,
    role: Role.STUDENT,
    ...(scope?.mode === "ids" ? { id: { in: scope.studentIds } } : {}),
    ...(year ? { studyYear: year } : {}),
    ...(q.length > 0
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { studentId: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

/** @deprecated ใช้ buildStudentChatPeerListWhere — คงไว้ให้เทส/คอลเก่า; ต้องมีคำค้นอย่างน้อย 2 ตัว */
export function buildStudentChatPeerSearchWhere(
  rawQuery: string,
  scope?: { mode: "all" } | { mode: "ids"; studentIds: string[] }
): Prisma.UserWhereInput | null {
  const q = rawQuery.trim().slice(0, 80);
  if (q.length < 2) {
    return null;
  }
  return buildStudentChatPeerListWhere(q, scope);
}

/** คำนวณ skip/take สำหรับตัดหน้ารายชื่อ peer */
export function resolvePeerListPaging(input: {
  page?: number;
  pageSize?: number;
  defaultPageSize: number;
  maxPageSize: number;
}): { page: number; pageSize: number; skip: number } {
  const pageSize = Math.min(
    input.maxPageSize,
    Math.max(1, Math.floor(input.pageSize ?? input.defaultPageSize) || input.defaultPageSize)
  );
  const page = Math.max(1, Math.floor(input.page ?? 1) || 1);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

/** อัปเดตเวลาอ่านของฝ่ายผู้ชม — กัน IDOR ด้วย participant */
export async function markEphemeralChatSessionRead(
  db: EphemeralChatDb,
  input: { sessionId: string; viewerUserId: string; at?: Date }
): Promise<boolean> {
  const session = await db.ephemeralChatSession.findUnique({
    where: { id: input.sessionId },
    select: { id: true, studentId: true, staffId: true },
  });
  if (!session || !isSessionParticipant(input.viewerUserId, session)) {
    return false;
  }
  const at = input.at ?? new Date();
  if (input.viewerUserId === session.studentId) {
    await db.ephemeralChatSession.update({
      where: { id: session.id },
      data: { studentLastReadAt: at },
    });
  } else {
    await db.ephemeralChatSession.update({
      where: { id: session.id },
      data: { staffLastReadAt: at },
    });
  }
  return true;
}

/** เปิดหรือคืนห้อง ACTIVE ของคู่นิสิต–บุคลากร และผูกคำขอปรึกษาถ้ามี */
export async function findOrCreateEphemeralChatSession(
  db: EphemeralChatDb,
  input: {
    studentId: string;
    staffId: string;
    consultationRequestId?: string | null;
  }
): Promise<EphemeralChatSessionRecord> {
  const openConsultation =
    input.consultationRequestId != null
      ? { id: input.consultationRequestId }
      : await findOpenConsultationForPair(db, input.studentId, input.staffId);

  const existing = await db.ephemeralChatSession.findUnique({
    where: {
      studentId_staffId: {
        studentId: input.studentId,
        staffId: input.staffId,
      },
    },
    include: sessionInclude,
  });

  if (existing) {
    if (
      openConsultation &&
      existing.consultationRequestId !== openConsultation.id
    ) {
      return db.ephemeralChatSession.update({
        where: { id: existing.id },
        data: { consultationRequestId: openConsultation.id },
        include: sessionInclude,
      });
    }
    return existing;
  }

  try {
    return await db.ephemeralChatSession.create({
      data: {
        studentId: input.studentId,
        staffId: input.staffId,
        status: EphemeralChatSessionStatus.ACTIVE,
        consultationRequestId: openConsultation?.id ?? null,
      },
      include: sessionInclude,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await db.ephemeralChatSession.findUnique({
        where: {
          studentId_staffId: {
            studentId: input.studentId,
            staffId: input.staffId,
          },
        },
        include: sessionInclude,
      });
      if (raced) {
        return raced;
      }
    }
    throw error;
  }
}

/** ลบห้องและข้อความทั้งหมด (hard-delete) */
export async function purgeEphemeralChatSession(
  db: EphemeralChatDb,
  sessionId: string
): Promise<boolean> {
  const result = await db.ephemeralChatSession.deleteMany({
    where: { id: sessionId },
  });
  return result.count > 0;
}

/** จบแชทโดยผู้เข้าร่วม — ลบทั้งห้อง */
export async function endEphemeralChatSession(
  db: EphemeralChatDb,
  input: { sessionId: string; actorUserId: string }
): Promise<{ deleted: boolean }> {
  const session = await db.ephemeralChatSession.findUnique({
    where: { id: input.sessionId },
    select: { id: true, studentId: true, staffId: true },
  });

  if (!session) {
    return { deleted: false };
  }

  if (!isSessionParticipant(input.actorUserId, session)) {
    throw Object.assign(new Error("Forbidden"), {
      status: 403,
      code: "CHAT_FORBIDDEN",
    });
  }

  const deleted = await purgeEphemeralChatSession(db, session.id);
  return { deleted };
}

/** ลบห้องที่ผูกกับคำขอปรึกษาเมื่อปิด/ยกเลิก */
export async function purgeEphemeralChatForConsultationRequest(
  db: EphemeralChatDb,
  consultationRequestId: string
): Promise<number> {
  const result = await db.ephemeralChatSession.deleteMany({
    where: { consultationRequestId },
  });
  return result.count;
}

/**
 * จุดเริ่มต้นวันตาม Asia/Bangkok (เที่ยงคืนไทย)
 * — ใช้เป็นเส้นตัดลบข้อความของวันก่อน
 */
export function getAsiaBangkokDayStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    const fallback = new Date(now);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  return new Date(`${year}-${month}-${day}T00:00:00+07:00`);
}

/**
 * ลบห้องที่ข้อความล่าสุด (หรือสร้างห้อง) ก่อนเที่ยงคืนไทยของวันนี้
 * — รันหลังเที่ยงคืนเพื่อเคลียร์ของวันก่อน
 */
export async function purgeEphemeralChatBeforeBangkokMidnight(
  db: EphemeralChatDb,
  now = new Date()
): Promise<number> {
  const dayStart = getAsiaBangkokDayStart(now);
  const result = await db.ephemeralChatSession.deleteMany({
    where: {
      OR: [
        { lastMessageAt: { lt: dayStart } },
        { lastMessageAt: null, createdAt: { lt: dayStart } },
      ],
    },
  });
  return result.count;
}

/**
 * เมื่อจำนวนข้อความทั้งระบบเกินเพดาน — ลบห้องเก่าสุดก่อนจนกว่าจะต่ำกว่าเป้า
 * (กันเซิร์ฟเวอร์แน่น / ช้า โดยไม่ต้องรอเที่ยงคืน)
 */
export async function purgeEphemeralChatUnderStoragePressure(
  db: EphemeralChatDb,
  maxMessages = Number.parseInt(
    process.env.EPHEMERAL_CHAT_MAX_MESSAGES || String(EPHEMERAL_CHAT_MAX_MESSAGES),
    10
  ) || EPHEMERAL_CHAT_MAX_MESSAGES
): Promise<{ deletedSessions: number; messageCountBefore: number }> {
  const messageCountBefore = await db.ephemeralChatMessage.count();
  if (messageCountBefore <= maxMessages) {
    return { deletedSessions: 0, messageCountBefore };
  }

  const target = Math.floor(maxMessages * EPHEMERAL_CHAT_PRESSURE_TARGET_RATIO);
  let deletedSessions = 0;

  while ((await db.ephemeralChatMessage.count()) > target) {
    const oldest = await db.ephemeralChatSession.findFirst({
      orderBy: [{ lastMessageAt: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    if (!oldest) {
      break;
    }
    await db.ephemeralChatSession.delete({ where: { id: oldest.id } });
    deletedSessions += 1;
    // กัน loop ไม่รู้จบถ้าลบไม่ได้จริง
    if (deletedSessions > 500) {
      break;
    }
  }

  return { deletedSessions, messageCountBefore };
}

/** รอบบำรุงรักษาแชทชั่วคราว: ลบของวันก่อนหลังเที่ยงคืนไทย + ลดแรงดันพื้นที่ */
export async function runEphemeralChatRetention(
  db: EphemeralChatDb,
  now = new Date()
): Promise<{ midnightDeleted: number; pressureDeleted: number }> {
  const midnightDeleted = await purgeEphemeralChatBeforeBangkokMidnight(db, now);
  const pressure = await purgeEphemeralChatUnderStoragePressure(db);
  return {
    midnightDeleted,
    pressureDeleted: pressure.deletedSessions,
  };
}

/** กรองข้อความหลัง cursor (createdAt, id) แบบ lexicographic */
export function isMessageAfterCursor(
  message: { id: string; createdAt: Date },
  cursor: { id: string; createdAt: Date } | null
): boolean {
  if (!cursor) {
    return true;
  }
  const t = message.createdAt.getTime();
  const c = cursor.createdAt.getTime();
  if (t > c) {
    return true;
  }
  if (t < c) {
    return false;
  }
  return message.id > cursor.id;
}
