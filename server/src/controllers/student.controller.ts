import { AssessmentInstrument, Role } from "@prisma/client";
import { Request, Response } from "express";
import { z } from "zod";
import { writeAuditLog, getRequestIpAddress } from "../lib/audit-log";
import { prisma } from "../lib/prisma";
import {
  createScreeningAlerts,
  getRiskLevelForAssessment,
  shouldEscalateToAdvancedAssessment,
} from "../lib/screening";
import { formatStudentIdForResponse } from "../lib/user-format";

const assessmentAnswerSchema = z.object({
  questionCode: z.string().trim().min(1).max(40),
  questionText: z.string().trim().min(1).max(500),
  answerValue: z.string().trim().min(1).max(200),
  score: z.number().int().min(0).max(10),
});

const submitAssessmentSchema = z.object({
  instrument: z.nativeEnum(AssessmentInstrument),
  answers: z.array(assessmentAnswerSchema).min(1).max(20),
});

const createSosSchema = z.object({
  summary: z.string().trim().min(1).max(4000),
});

export const getStudentDashboard = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const [student, latestAssessments, alerts, emergencyCases] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          studentId: true,
          email: true,
        },
      }),
      prisma.studentAssessment.findMany({
        where: { studentId: userId },
        orderBy: { assessedAt: "desc" },
        take: 5,
        select: {
          id: true,
          instrument: true,
          totalScore: true,
          riskLevel: true,
          assessedAt: true,
        },
      }),
      prisma.alert.findMany({
        where: {
          recipientUserId: userId,
          status: "OPEN",
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.emergencyCase.findMany({
        where: { studentId: userId },
        orderBy: { openedAt: "desc" },
        take: 5,
      }),
    ]);

    res.status(200).json({
      student: student
        ? {
            ...student,
            studentId: formatStudentIdForResponse(student.studentId),
          }
        : null,
      latestAssessments,
      alerts,
      emergencyCases,
      nextRecommendedInstruments: [
        AssessmentInstrument.Q2,
        AssessmentInstrument.ST5,
      ],
    });
  } catch (error) {
    console.error("Get student dashboard error:", error);
    res.status(500).json({ message: "Failed to fetch student dashboard" });
  }
};

export const submitAssessment = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = submitAssessmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const totalScore = parsed.data.answers.reduce((sum, answer) => sum + answer.score, 0);
    const riskLevel = getRiskLevelForAssessment(parsed.data.instrument, totalScore);

    const assessment = await prisma.studentAssessment.create({
      data: {
        studentId: userId,
        instrument: parsed.data.instrument,
        totalScore,
        riskLevel,
        assessedAt: new Date(),
        answers: {
          create: parsed.data.answers.map((answer) => ({
            questionCode: answer.questionCode,
            questionText: answer.questionText,
            answerValue: answer.answerValue,
            score: answer.score,
          })),
        },
      },
      include: {
        answers: true,
      },
    });

    await createScreeningAlerts(userId, totalScore, parsed.data.instrument);
    await writeAuditLog({
      actorUserId: userId,
      action: "student.assessment.submit",
      entityType: "StudentAssessment",
      entityId: assessment.id,
      description: `นักศึกษาส่งแบบประเมิน ${parsed.data.instrument} คะแนนรวม ${totalScore}`,
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "บันทึกแบบประเมินสำเร็จ",
      assessment,
      nextStep: shouldEscalateToAdvancedAssessment(parsed.data.instrument, totalScore)
        ? {
            requiresAdvancedAssessment: true,
            recommendedInstruments: [AssessmentInstrument.Q9, AssessmentInstrument.Q8],
          }
        : {
            requiresAdvancedAssessment: false,
            recommendedInstruments: [],
          },
    });
  } catch (error) {
    console.error("Submit assessment error:", error);
    res.status(500).json({ message: "Failed to submit assessment" });
  }
};

export const createSosCase = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.userId;
  if (!userId || req.user?.role !== Role.STUDENT) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const parsed = createSosSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid payload",
      errors: parsed.error.flatten(),
    });
    return;
  }

  try {
    const emergencyCase = await prisma.emergencyCase.create({
      data: {
        studentId: userId,
        reportedByUserId: userId,
        summary: parsed.data.summary,
      },
    });

    const mentalHealthUsers = await prisma.user.findMany({
      where: {
        role: Role.MENTAL_HEALTH,
        isActive: true,
      },
      select: { id: true },
    });

    if (mentalHealthUsers.length > 0) {
      await prisma.alert.createMany({
        data: mentalHealthUsers.map((user) => ({
          recipientUserId: user.id,
          actorUserId: userId,
          studentId: userId,
          type: "SOS_OPENED",
          priority: "CRITICAL",
          title: "มีการกดปุ่ม SOS",
          message: parsed.data.summary,
          sourceType: "EmergencyCase",
          sourceId: emergencyCase.id,
        })),
      });
    }

    await writeAuditLog({
      actorUserId: userId,
      action: "student.sos.create",
      entityType: "EmergencyCase",
      entityId: emergencyCase.id,
      description: "นักศึกษากดปุ่ม SOS",
      ipAddress: getRequestIpAddress(req),
    });

    res.status(201).json({
      message: "ส่งสัญญาณฉุกเฉินสำเร็จ",
      emergencyCase,
    });
  } catch (error) {
    console.error("Create SOS case error:", error);
    res.status(500).json({ message: "Failed to create SOS case" });
  }
};
