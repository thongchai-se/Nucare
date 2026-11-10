import {
  AlertPriority,
  AlertType,
  AssessmentInstrument,
  RiskLevel,
} from "@prisma/client";
import { notifyHighRiskScreening } from "./high-risk-screening-notify";
import { prisma } from "./prisma";

export const getRiskLevelForAssessment = (
  instrument: AssessmentInstrument,
  totalScore: number
): RiskLevel => {
  if (instrument === AssessmentInstrument.Q8) {
    return totalScore >= 1 ? RiskLevel.HIGH : RiskLevel.NORMAL;
  }

  if (instrument === AssessmentInstrument.Q9) {
    if (totalScore >= 10) {
      return RiskLevel.HIGH;
    }
    if (totalScore >= 5) {
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.NORMAL;
  }

  if (instrument === AssessmentInstrument.Q2) {
    return totalScore >= 1 ? RiskLevel.MEDIUM : RiskLevel.NORMAL;
  }

  if (instrument === AssessmentInstrument.ST5) {
    return totalScore >= 8 ? RiskLevel.MEDIUM : RiskLevel.NORMAL;
  }

  return RiskLevel.NORMAL;
};

export const shouldEscalateToAdvancedAssessment = (
  instrument: AssessmentInstrument,
  totalScore: number
): boolean => {
  if (instrument === AssessmentInstrument.Q2) {
    return totalScore >= 1;
  }

  if (instrument === AssessmentInstrument.ST5) {
    return totalScore >= 5;
  }

  return false;
};

export const createScreeningAlerts = async (
  studentId: string,
  totalScore: number,
  instrument: AssessmentInstrument
) => {
  if (instrument === AssessmentInstrument.Q9 && totalScore >= 5 && totalScore <= 9) {
    const assignments = await prisma.studentAdvisorAssignment.findMany({
      where: {
        studentId,
        isActive: true,
      },
      select: {
        advisorId: true,
      },
    });

    if (assignments.length > 0) {
      await prisma.alert.createMany({
        data: assignments.map((assignment) => ({
          recipientUserId: assignment.advisorId,
          studentId,
          type: AlertType.ADVISOR_FOLLOW_UP,
          priority: AlertPriority.MEDIUM,
          title: "ติดตามนักศึกษาภายใน 1 สัปดาห์",
          message: "นักศึกษามีคะแนน 9Q อยู่ในช่วง 5-9 คะแนน กรุณานัดพูดคุยติดตามผล",
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          sourceType: "StudentAssessment",
        })),
      });
    }
  }

  if (
    (instrument === AssessmentInstrument.Q9 && totalScore >= 10) ||
    (instrument === AssessmentInstrument.Q8 && totalScore >= 1)
  ) {
    // แจ้งที่ปรึกษา (อีเมล+ในแอป) — ไม่สร้างคิว MH อัตโนมัติ
    await notifyHighRiskScreening({
      studentId,
      sourceLabel: instrument,
      sourceType: "StudentAssessment",
    });
  }
};

/**
 * สร้างแจ้งเตือนทีมจากผลแบบสอบถาม (GHQ/custom) — ข้อความกลาง ๆ ไม่ระบุเหตุผลคัดเลือกกลุ่ม
 */
export const createSurveyScreeningAlerts = async (input: {
  studentId: string;
  responseId: string;
  riskLevel: RiskLevel;
  instrumentLabel?: string | null;
}): Promise<void> => {
  const { studentId, responseId, riskLevel } = input;

  if (riskLevel === RiskLevel.MEDIUM) {
    const assignments = await prisma.studentAdvisorAssignment.findMany({
      where: {
        studentId,
        isActive: true,
      },
      select: {
        advisorId: true,
      },
    });

    if (assignments.length > 0) {
      await prisma.alert.createMany({
        data: assignments.map((assignment) => ({
          recipientUserId: assignment.advisorId,
          studentId,
          type: AlertType.ADVISOR_FOLLOW_UP,
          priority: AlertPriority.MEDIUM,
          title: "ติดตามนักศึกษาหลังแบบประเมิน",
          message: "มีผลแบบประเมินที่ควรติดตาม กรุณานัดพูดคุยภายใน 1 สัปดาห์",
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          sourceType: "SurveyResponse",
          sourceId: responseId,
        })),
      });
    }
  }

  if (riskLevel === RiskLevel.HIGH) {
    await notifyHighRiskScreening({
      studentId,
      sourceLabel: input.instrumentLabel?.trim() || "แบบประเมิน",
      sourceType: "SurveyResponse",
      sourceId: responseId,
    });
  }
};
