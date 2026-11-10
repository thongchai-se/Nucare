import {
  AlertPriority,
  AlertStatus,
  AlertType,
  Role,
  type PrismaClient,
} from "@prisma/client";
import { buildUserHasRoleWhere } from "../roles";
import type { WellnessTrendSignalCode } from "./wellness-signals";

const CRISIS_CODE: WellnessTrendSignalCode = "SELF_HARM_CRISIS";
const CRISIS_ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** มีสัญญาณวิกฤตในชุดรหัสหรือไม่ — แจ้งเฉพาะวิกฤต ไม่รบกวนทุกธีม */
export function shouldNotifyCrisisWellness(codes: WellnessTrendSignalCode[]): boolean {
  return codes.includes(CRISIS_CODE);
}

/**
 * แจ้งที่ปรึกษาที่มอบหมาย + ทีมสุขภาพจิต เมื่อแชทตรวจพบ SELF_HARM_CRISIS
 * (ไม่เก็บข้อความแชทในแจ้งเตือน) และกันแจ้งซ้ำภายใน 24 ชม. ต่อนิสิต
 */
export const notifyAdvisorsOfWellnessSignals = async (
  db: PrismaClient,
  studentId: string,
  codes: WellnessTrendSignalCode[]
): Promise<number> => {
  if (!shouldNotifyCrisisWellness(codes)) {
    return 0;
  }

  const recent = await db.alert.findFirst({
    where: {
      studentId,
      sourceType: "StudentWellnessTrend",
      type: AlertType.ADVISOR_FOLLOW_UP,
      priority: AlertPriority.CRITICAL,
      createdAt: { gte: new Date(Date.now() - CRISIS_ALERT_COOLDOWN_MS) },
      status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
    },
    select: { id: true },
  });
  if (recent) {
    return 0;
  }

  const [assignments, mentalHealthUsers] = await Promise.all([
    db.studentAdvisorAssignment.findMany({
      where: { studentId, isActive: true },
      select: { advisorId: true },
    }),
    db.user.findMany({
      where: {
        ...buildUserHasRoleWhere(Role.MENTAL_HEALTH),
        isActive: true,
      },
      select: { id: true },
    }),
  ]);

  const recipientIds = new Set<string>();
  for (const assignment of assignments) {
    recipientIds.add(assignment.advisorId);
  }
  for (const user of mentalHealthUsers) {
    recipientIds.add(user.id);
  }

  if (recipientIds.size === 0) {
    return 0;
  }

  await db.alert.createMany({
    data: Array.from(recipientIds).map((recipientUserId) => ({
      recipientUserId,
      studentId,
      type: AlertType.ADVISOR_FOLLOW_UP,
      priority: AlertPriority.CRITICAL,
      title: "สัญญาณวิกฤตจากแชทเพื่อน AI",
      message:
        "ระบบตรวจพบสัญญาณที่อาจเกี่ยวกับการทำร้ายตนเองจากแชท กรุณาเปิดดูนิสิตและติดต่อช่วยเหลือตามแนวทางคณะ — ไม่มีข้อความแชทในแจ้งเตือนนี้",
      sourceType: "StudentWellnessTrend",
      sourceId: studentId,
    })),
  });

  return recipientIds.size;
};
