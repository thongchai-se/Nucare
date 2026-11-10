import { AlertPriority, AlertType, Role } from "@prisma/client";
import {
  buildHighRiskAdvisorEmail,
  buildHighRiskUnassignedEmail,
} from "./email/messages";
import { notifyUser } from "./notify-user";
import { prisma } from "./prisma";
import { buildUserHasRoleWhere } from "./roles";
import { formatStudentIdForResponse } from "./user-format";

export type HighRiskNotifyPlan =
  | {
      action: "notify_advisors";
      advisorIds: string[];
      title: string;
      message: string;
    }
  | {
      action: "notify_staff_unassigned";
      title: string;
      message: string;
    };

/** วางแผนแจ้งที่ปรึกษาเมื่อผลคัดกรอง HIGH — ไม่สร้างคิว MH อัตโนมัติ */
export function planHighRiskScreeningNotify(input: {
  assignedAdvisorIds: string[];
  sourceLabel: string;
}): HighRiskNotifyPlan {
  const source = input.sourceLabel.trim() || "แบบประเมิน";
  if (input.assignedAdvisorIds.length > 0) {
    return {
      action: "notify_advisors",
      advisorIds: Array.from(new Set(input.assignedAdvisorIds)),
      title: "ผลคัดกรองความเสี่ยงสูง — โปรดติดตาม",
      message: `พบผลคัดกรองความเสี่ยงสูง (${source}) กรุณาติดตามนิสิต และส่งต่อไปศูนย์ให้คำปรึกษาเมื่อเห็นสมควร`,
    };
  }
  return {
    action: "notify_staff_unassigned",
    title: "นิสิตความเสี่ยงสูงยังไม่มีที่ปรึกษา",
    message: `พบผลคัดกรองความเสี่ยงสูง (${source}) แต่ยังไม่มีที่ปรึกษาประจำ กรุณามอบหมายที่ปรึกษาและติดตามต่อ`,
  };
}

/**
 * แจ้งที่ปรึกษา (หรือ SD/ADMIN ถ้ายังไม่มอบหมาย) เมื่อผลคัดกรอง HIGH
 * — ไม่สร้าง CaseReferral / ไม่แจ้งทีม MH โดยตรง
 */
export async function notifyHighRiskScreening(input: {
  studentId: string;
  sourceLabel: string;
  sourceType: "SurveyResponse" | "StudentAssessment";
  sourceId?: string | null;
}): Promise<{ notified: number; mode: HighRiskNotifyPlan["action"] }> {
  const [student, assignments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.studentId },
      select: { id: true, name: true, studentId: true },
    }),
    prisma.studentAdvisorAssignment.findMany({
      where: { studentId: input.studentId, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { advisorId: true },
    }),
  ]);

  if (!student) {
    return { notified: 0, mode: "notify_staff_unassigned" };
  }

  const plan = planHighRiskScreeningNotify({
    assignedAdvisorIds: assignments.map((row) => row.advisorId),
    sourceLabel: input.sourceLabel,
  });

  const studentIdLabel = formatStudentIdForResponse(student.studentId);

  if (plan.action === "notify_advisors") {
    const advisors = await prisma.user.findMany({
      where: { id: { in: plan.advisorIds }, isActive: true },
      select: { id: true, email: true },
    });
    const emailCopy = buildHighRiskAdvisorEmail({
      studentName: student.name,
      studentIdLabel,
      sourceLabel: input.sourceLabel,
    });

    let notified = 0;
    for (const advisor of advisors) {
      await notifyUser({
        recipientUserId: advisor.id,
        recipientEmail: advisor.email,
        channels: { inApp: true, email: true },
        alert: {
          studentId: student.id,
          type: AlertType.HIGH_RISK_SCREENING,
          priority: AlertPriority.CRITICAL,
          title: plan.title,
          message: plan.message,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
        },
        email: emailCopy,
      });
      notified += 1;
    }
    return { notified, mode: plan.action };
  }

  const staff = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [buildUserHasRoleWhere(Role.STUDENT_DEVELOPMENT), buildUserHasRoleWhere(Role.ADMIN)],
    },
    select: { id: true, email: true },
  });
  const emailCopy = buildHighRiskUnassignedEmail({
    studentName: student.name,
    studentIdLabel,
    sourceLabel: input.sourceLabel,
  });

  let notified = 0;
  for (const user of staff) {
    await notifyUser({
      recipientUserId: user.id,
      recipientEmail: user.email,
      channels: { inApp: true, email: true },
      alert: {
        studentId: student.id,
        type: AlertType.HIGH_RISK_SCREENING,
        priority: AlertPriority.CRITICAL,
        title: plan.title,
        message: plan.message,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
      },
      email: emailCopy,
    });
    notified += 1;
  }

  return { notified, mode: plan.action };
}
