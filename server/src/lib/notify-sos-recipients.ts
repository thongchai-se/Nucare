import { AlertPriority, AlertStatus, AlertType, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { buildUserHasRoleWhere } from "./roles";

export type SosRecipient = {
  id: string;
  email: string | null;
  kind: "MENTAL_HEALTH" | "ADVISOR";
};

/** รวมรายชื่อผู้รับ SOS โดยให้ MENTAL_HEALTH มาก่อน และตัด id ซ้ำ */
export function mergeSosRecipients(input: {
  mentalHealthUsers: Array<{ id: string; email: string | null }>;
  advisors: Array<{ id: string; email: string | null; isActive: boolean }>;
}): SosRecipient[] {
  const byId = new Map<string, SosRecipient>();

  for (const user of input.mentalHealthUsers) {
    byId.set(user.id, { id: user.id, email: user.email, kind: "MENTAL_HEALTH" });
  }

  for (const advisor of input.advisors) {
    if (!advisor.isActive || byId.has(advisor.id)) {
      continue;
    }
    byId.set(advisor.id, { id: advisor.id, email: advisor.email, kind: "ADVISOR" });
  }

  return Array.from(byId.values());
}

/**
 * รวมผู้รับแจ้งเตือน SOS: ทีมสุขภาพจิตทุกคนที่ใช้งาน + ที่ปรึกษาที่มอบหมายอยู่
 * (ตัดซ้ำถ้าคนเดียวกันมีหลายบทบาท)
 */
export async function listSosAlertRecipients(studentId: string): Promise<SosRecipient[]> {
  const [mentalHealthUsers, advisorAssignments] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...buildUserHasRoleWhere(Role.MENTAL_HEALTH),
        isActive: true,
      },
      select: { id: true, email: true },
    }),
    prisma.studentAdvisorAssignment.findMany({
      where: {
        studentId,
        isActive: true,
      },
      select: {
        advisor: {
          select: { id: true, email: true, isActive: true },
        },
      },
    }),
  ]);

  return mergeSosRecipients({
    mentalHealthUsers,
    advisors: advisorAssignments
      .map((assignment) => assignment.advisor)
      .filter((advisor): advisor is NonNullable<typeof advisor> => Boolean(advisor)),
  });
}

/** สร้าง in-app alert SOS ให้ผู้รับทั้งหมด (ไม่ส่งอีเมลที่นี่ — เรียก notify แยกถ้าต้องการ) */
export async function createSosOpenedAlerts(input: {
  studentId: string;
  actorUserId: string;
  emergencyCaseId: string;
  summary: string;
  recipients: SosRecipient[];
}): Promise<number> {
  if (input.recipients.length === 0) {
    return 0;
  }

  const message = input.summary.trim().slice(0, 500) || "นิสิตขอความช่วยเหลือด่วน";

  await prisma.alert.createMany({
    data: input.recipients.map((recipient) => ({
      recipientUserId: recipient.id,
      actorUserId: input.actorUserId,
      studentId: input.studentId,
      type: AlertType.SOS_OPENED,
      priority: AlertPriority.CRITICAL,
      title: recipient.kind === "ADVISOR" ? "นิสิตในดูแลกดขอความช่วยเหลือด่วน" : "มีเคสช่วยเหลือด่วน (SOS)",
      message,
      sourceType: "EmergencyCase",
      sourceId: input.emergencyCaseId,
    })),
  });

  return input.recipients.length;
}

/** ปิดแจ้งเตือน SOS ที่ผูกกับเคสเมื่อรับ/ปิดแล้ว เพื่อไม่ให้ค้างใน inbox ทั้งทีม */
export async function closeSosAlertsForCase(emergencyCaseId: string): Promise<number> {
  const result = await prisma.alert.updateMany({
    where: {
      sourceType: "EmergencyCase",
      sourceId: emergencyCaseId,
      status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
    },
    data: {
      status: AlertStatus.CLOSED,
      closedAt: new Date(),
    },
  });
  return result.count;
}
