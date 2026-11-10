import {
  AlertPriority,
  AlertType,
  BehaviorSeverity,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "./prisma";
import { getBehaviorRecordFollowUpStatus } from "./behavior-follow-up";
import { buildObservationRoadmap } from "./observation-roadmap";
import { formatStudentIdForResponse } from "./user-format";

export const OBSERVATION_STUDENT_SEARCH_MAX = 50;
export const OBSERVATION_RECORD_LIST_MAX = 300;

export type CreateObservationInput = {
  reporterUserId: string;
  studentId: string;
  observedAt: Date;
  category: string;
  details: string;
  severity: BehaviorSeverity;
};

/**
 * กฎธุรกิจ: แจ้งข้อสังเกตได้เฉพาะนิสิตที่ไม่อยู่ในสังกัดผู้แจ้ง
 * — เมนูนี้สำหรับส่งสัญญาณไปที่ปรึกษาของนิสิตคนอื่น
 */
export function canReportObservationAboutStudent(reporterIsOwnAdvisor: boolean): boolean {
  return !reporterIsOwnAdvisor;
}

/** ตรวจว่าผู้ใช้เป็นที่ปรึกษาที่ใช้งานของนิสิตคนนี้หรือไม่ */
export async function isActiveAdvisorOfStudent(
  advisorId: string,
  studentId: string
): Promise<boolean> {
  const assignment = await prisma.studentAdvisorAssignment.findFirst({
    where: {
      advisorId,
      studentId,
      isActive: true,
    },
    select: { id: true },
  });
  return Boolean(assignment);
}

/**
 * ตรวจเป้าหมายก่อนแจ้งข้อสังเกต — ต้องเป็นนิสิตใช้งาน และไม่ใช่ในสังกัดผู้แจ้ง
 */
export async function assertObservationReportTarget(
  reporterUserId: string,
  studentId: string
): Promise<{ ok: true } | { ok: false; status: 400 | 404; message: string; code?: string }> {
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: Role.STUDENT,
      isActive: true,
    },
    select: { id: true },
  });

  if (!student) {
    return { ok: false, status: 404, message: "ไม่พบนิสิตที่ระบุ" };
  }

  const ownAdvisee = await isActiveAdvisorOfStudent(reporterUserId, studentId);
  if (!canReportObservationAboutStudent(ownAdvisee)) {
    return {
      ok: false,
      status: 400,
      code: "OWN_ADVISEE_NOT_ALLOWED",
      message:
        "ไม่สามารถแจ้งข้อสังเกตนิสิตในสังกัดตัวเองได้ — ใช้เมนูนี้สำหรับแจ้งนิสิตของอาจารย์ท่านอื่น และสัญญาณจะเข้าที่ปรึกษาของนิสิตคนนั้น",
    };
  }

  return { ok: true };
}

/**
 * @deprecated ใช้ assertObservationReportTarget แทน — คงไว้ให้ import เดิมไม่พัง
 */
export async function assertActiveStudentTarget(studentId: string): Promise<
  | { ok: true }
  | { ok: false; status: 404; message: string }
> {
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: Role.STUDENT,
      isActive: true,
    },
    select: { id: true },
  });

  if (!student) {
    return { ok: false, status: 404, message: "ไม่พบนิสิตที่ระบุ" };
  }

  return { ok: true };
}

/**
 * ค้นหานิสิตสำหรับฟอร์มแจ้งข้อสังเกต — ตัดนิสิตในสังกัดผู้แจ้งออก
 * (เมนูนี้สำหรับแจ้งเด็กของอาจารย์คนอื่น)
 */
export async function searchStudentsForObservation(search?: string, reporterUserId?: string) {
  const normalized = search?.trim();
  const where: Prisma.UserWhereInput = {
    role: Role.STUDENT,
    isActive: true,
    ...(normalized
      ? {
          OR: [
            { name: { contains: normalized, mode: "insensitive" } },
            { studentId: { contains: normalized, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(reporterUserId
      ? {
          NOT: {
            studentAssignments: {
              some: {
                advisorId: reporterUserId,
                isActive: true,
              },
            },
          },
        }
      : {}),
  };

  const students = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      studentId: true,
      studyYear: true,
      section: true,
    },
    orderBy: [{ name: "asc" }, { studentId: "asc" }],
    take: OBSERVATION_STUDENT_SEARCH_MAX,
  });

  return students.map((student) => ({
    id: student.id,
    name: student.name,
    studentId: formatStudentIdForResponse(student.studentId),
    studyYear: student.studyYear,
    section: student.section,
  }));
}

/**
 * บันทึกข้อสังเกตแล้วแจ้งที่ปรึกษาที่รับผิดชอบนิสิตคนนั้น (สัญญาณเข้า)
 * ฟิลด์ instructorId ใน DB ใช้เก็บผู้แจ้ง (legacy ชื่อคอลัมน์)
 * หมายเหตุ: เรียกหลัง assertObservationReportTarget แล้วเท่านั้น
 */
export async function createStudentObservation(input: CreateObservationInput) {
  const ownAdvisee = await isActiveAdvisorOfStudent(input.reporterUserId, input.studentId);
  if (!canReportObservationAboutStudent(ownAdvisee)) {
    throw new Error("OWN_ADVISEE_NOT_ALLOWED");
  }

  const behaviorRecord = await prisma.behaviorRecord.create({
    data: {
      studentId: input.studentId,
      instructorId: input.reporterUserId,
      observedAt: input.observedAt,
      category: input.category,
      details: input.details,
      severity: input.severity,
    },
  });

  const assignments = await prisma.studentAdvisorAssignment.findMany({
    where: {
      studentId: input.studentId,
      isActive: true,
      advisor: {
        isActive: true,
        OR: [
          { role: Role.ADVISOR },
          { additionalRoles: { has: Role.ADVISOR } },
          { role: Role.INSTRUCTOR },
          { additionalRoles: { has: Role.INSTRUCTOR } },
        ],
      },
    },
    select: {
      advisorId: true,
      advisor: { select: { name: true } },
    },
  });

  // ส่งสัญญาณถึงที่ปรึกษาของนิสิตทุกคน (ผู้แจ้งไม่ใช่ที่ปรึกษาอยู่แล้วตาม assert)
  const recipientIds = Array.from(new Set(assignments.map((assignment) => assignment.advisorId)));

  if (recipientIds.length > 0) {
    await prisma.alert.createMany({
      data: recipientIds.map((advisorId) => ({
        recipientUserId: advisorId,
        actorUserId: input.reporterUserId,
        studentId: input.studentId,
        type: AlertType.BEHAVIOR_REPORTED,
        priority:
          input.severity === BehaviorSeverity.HIGH ? AlertPriority.HIGH : AlertPriority.MEDIUM,
        // ชื่อนิสิตโชว์แยกใน UI — ไม่ใส่ซ้ำใน title
        title: "ข้อสังเกตจากอาจารย์",
        message: `${input.category}: ${input.details}`,
        sourceType: "BehaviorRecord",
        sourceId: behaviorRecord.id,
      })),
    });
  }

  return {
    behaviorRecord,
    notifiedAdvisorCount: recipientIds.length,
  };
}

/** รายการข้อสังเกตที่ผู้ใช้เป็นผู้แจ้ง พร้อมสถานะติดตามจาก Alert */
export async function listReporterObservations(reporterUserId: string) {
  const behaviorRecords = await prisma.behaviorRecord.findMany({
    where: { instructorId: reporterUserId },
    select: {
      id: true,
      category: true,
      details: true,
      severity: true,
      observedAt: true,
      createdAt: true,
      student: {
        select: {
          id: true,
          name: true,
          studentId: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: OBSERVATION_RECORD_LIST_MAX,
  });

  const sourceIds = behaviorRecords.map((record) => record.id);
  const studentIds = [...new Set(behaviorRecords.map((record) => record.student.id))];
  const earliestCreatedAt =
    behaviorRecords.length > 0
      ? behaviorRecords.reduce(
          (min, record) => (record.createdAt < min ? record.createdAt : min),
          behaviorRecords[0]!.createdAt
        )
      : null;

  const [alerts, referrals] = await Promise.all([
    sourceIds.length > 0
      ? prisma.alert.findMany({
          where: {
            sourceType: "BehaviorRecord",
            sourceId: { in: sourceIds },
          },
          select: {
            id: true,
            sourceId: true,
            status: true,
            updatedAt: true,
            acknowledgedAt: true,
            closedAt: true,
            resolutionNote: true,
            recipient: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    studentIds.length > 0 && earliestCreatedAt
      ? prisma.caseReferral.findMany({
          where: {
            studentId: { in: studentIds },
            createdAt: { gte: earliestCreatedAt },
          },
          select: {
            id: true,
            studentId: true,
            createdAt: true,
            target: true,
            reason: true,
            status: true,
            advisor: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 500,
        })
      : Promise.resolve([]),
  ]);

  const alertsBySourceId = new Map<
    string,
    Array<{
      id: string;
      status: (typeof alerts)[number]["status"];
      updatedAt: Date;
      acknowledgedAt: Date | null;
      closedAt: Date | null;
      resolutionNote: string | null;
      recipientName: string;
    }>
  >();

  for (const alert of alerts) {
    if (!alert.sourceId) {
      continue;
    }
    const current = alertsBySourceId.get(alert.sourceId) || [];
    current.push({
      id: alert.id,
      status: alert.status,
      updatedAt: alert.updatedAt,
      acknowledgedAt: alert.acknowledgedAt,
      closedAt: alert.closedAt,
      resolutionNote: alert.resolutionNote,
      recipientName: alert.recipient.name,
    });
    alertsBySourceId.set(alert.sourceId, current);
  }

  const referralTargetLabel = (target: string): string => {
    if (target === "COUNSELING_CENTER") {
      return "ทีมสุขภาพจิต / จิตแพทย์";
    }
    if (target === "STUDENT_DEVELOPMENT") {
      return "ฝ่ายพัฒนานักศึกษา";
    }
    return target;
  };

  return behaviorRecords.map((record) => {
    const related = alertsBySourceId.get(record.id) || [];
    const relatedReferrals = referrals
      .filter(
        (referral) =>
          referral.studentId === record.student.id && referral.createdAt >= record.createdAt
      )
      .map((referral) => ({
        id: referral.id,
        createdAt: referral.createdAt,
        targetLabel: referralTargetLabel(referral.target),
        reason: referral.reason,
        advisorName: referral.advisor.name,
        status: referral.status,
      }));

    return {
      id: record.id,
      category: record.category,
      details: record.details,
      severity: record.severity,
      observedAt: record.observedAt,
      createdAt: record.createdAt,
      status: getBehaviorRecordFollowUpStatus(related.map((item) => item.status)),
      advisorRecipients: Array.from(new Set(related.map((item) => item.recipientName))).filter(Boolean),
      roadmap: buildObservationRoadmap({
        createdAt: record.createdAt,
        alerts: related,
        referrals: relatedReferrals,
      }),
      student: {
        id: record.student.id,
        name: record.student.name,
        studentId: formatStudentIdForResponse(record.student.studentId),
      },
    };
  });
}
