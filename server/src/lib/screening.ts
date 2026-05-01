import {
  AlertPriority,
  AlertType,
  AssessmentInstrument,
  EmergencyCaseStatus,
  RiskLevel,
  Role,
} from "@prisma/client";
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

export const createScreeningAlerts = async (studentId: string, totalScore: number, instrument: AssessmentInstrument) => {
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
    const mentalHealthUsers = await prisma.user.findMany({
      where: {
        role: Role.MENTAL_HEALTH,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (mentalHealthUsers.length > 0) {
      await prisma.alert.createMany({
        data: mentalHealthUsers.map((user) => ({
          recipientUserId: user.id,
          studentId,
          type: AlertType.HIGH_RISK_SCREENING,
          priority: AlertPriority.CRITICAL,
          title: "เคสคัดกรองความเสี่ยงสูง",
          message: "พบผลคัดกรองเข้าข่ายดูแลพิเศษ กรุณารับเคสทันที",
          sourceType: "StudentAssessment",
        })),
      });
    }

    const existingOpenCase = await prisma.emergencyCase.findFirst({
      where: {
        studentId,
        status: {
          in: [EmergencyCaseStatus.OPEN, EmergencyCaseStatus.IN_PROGRESS],
        },
      },
      select: {
        id: true,
      },
    });

    if (!existingOpenCase) {
      await prisma.emergencyCase.create({
        data: {
          studentId,
          summary: "Auto-open case จากผลคัดกรองความเสี่ยงสูง",
        },
      });
    }
  }
};
