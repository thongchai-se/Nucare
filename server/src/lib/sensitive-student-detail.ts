import { RiskLevel, Role, type PrismaClient } from "@prisma/client";
import { canAccessStudent, getStudentScopeWhere } from "./access-control";
import {
  hasCrisisWellnessSignal,
  loadWellnessSignalsByStudentId,
  type StudentWellnessSignalDto,
} from "./student-wellness-summary";
import { getLatestActiveSurveyResultsForStudents } from "./survey-results";
import {
  formatStudentIdForResponse,
  getUserInitials,
  inferStudyYear,
  normalizeRiskLevel,
} from "./user-format";

export type SensitiveStudentCard = {
  id: string;
  studentId: string | null;
  name: string;
  image: string;
  year: string;
  riskLevel: ReturnType<typeof normalizeRiskLevel>;
  lastAssessment: Date | string | null;
  careRecordCount: number;
  behaviorRecordCount: number;
  latestScore: number | null;
  latestInstrument: string | null;
  wellnessSignals: StudentWellnessSignalDto[];
  hasCrisisWellnessSignal: boolean;
};

const LIST_MAX = 1000;

/** รายการนิสิตพร้อมผลละเอียดอ่อน — ใช้กับที่ปรึกษา (scope) / ผู้บริหาร (ทั้งคณะ) */
export const listSensitiveStudentCards = async (
  db: PrismaClient,
  role: Role | Role[],
  userId: string,
  search?: string
): Promise<SensitiveStudentCard[]> => {
  const where = await getStudentScopeWhere(role, userId);
  const students = await db.user.findMany({
    where: {
      ...where,
      ...(search
        ? {
            OR: [
              { studentId: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      studentId: true,
      studyYear: true,
      name: true,
      studentAssessments: {
        orderBy: { assessedAt: "desc" as const },
        take: 1,
        select: {
          riskLevel: true,
          assessedAt: true,
          totalScore: true,
          instrument: true,
        },
      },
      _count: {
        select: {
          studentCareRecords: true,
          studentBehaviorRecords: true,
        },
      },
    },
    orderBy: [{ studentId: "asc" }, { createdAt: "desc" }],
    take: LIST_MAX,
  });

  const ids = students.map((student) => student.id);
  const [latestSurveyByStudentId, wellnessByStudentId] = await Promise.all([
    getLatestActiveSurveyResultsForStudents(ids),
    loadWellnessSignalsByStudentId(db, ids),
  ]);

  return students.map((student) => {
    const latestSurvey = latestSurveyByStudentId.get(student.id);
    const latestAssessment = student.studentAssessments[0] ?? null;
    const wellnessSignals = wellnessByStudentId.get(student.id) ?? [];
    return {
      id: student.id,
      studentId: formatStudentIdForResponse(student.studentId),
      name: student.name,
      image: getUserInitials(student.name, "นศ"),
      year: inferStudyYear(student.studentId, student.studyYear),
      riskLevel: normalizeRiskLevel(latestSurvey?.riskLevel ?? latestAssessment?.riskLevel ?? RiskLevel.NORMAL),
      lastAssessment: latestSurvey?.assessedAt ?? latestAssessment?.assessedAt ?? null,
      careRecordCount: student._count.studentCareRecords,
      behaviorRecordCount: student._count.studentBehaviorRecords,
      latestScore: latestSurvey?.totalScore ?? latestAssessment?.totalScore ?? null,
      latestInstrument: latestSurvey?.instrument ?? latestAssessment?.instrument ?? null,
      wellnessSignals,
      hasCrisisWellnessSignal: hasCrisisWellnessSignal(wellnessSignals),
    };
  });
};

/** รายละเอียดนิสิตรายคน (ผลละเอียดอ่อน) หลังผ่าน canAccessStudent */
export const getSensitiveStudentCard = async (
  db: PrismaClient,
  role: Role | Role[],
  userId: string,
  studentUserId: string
): Promise<"forbidden" | "not_found" | SensitiveStudentCard> => {
  const allowed = await canAccessStudent(role, userId, studentUserId);
  if (!allowed) {
    return "forbidden";
  }

  const student = await db.user.findFirst({
    where: { id: studentUserId, role: Role.STUDENT, isActive: true },
    select: {
      id: true,
      studentId: true,
      studyYear: true,
      name: true,
      studentAssessments: {
        orderBy: { assessedAt: "desc" as const },
        take: 1,
        select: {
          riskLevel: true,
          assessedAt: true,
          totalScore: true,
          instrument: true,
        },
      },
      _count: {
        select: {
          studentCareRecords: true,
          studentBehaviorRecords: true,
        },
      },
    },
  });

  if (!student) {
    return "not_found";
  }

  const [latestSurveyByStudentId, wellnessByStudentId] = await Promise.all([
    getLatestActiveSurveyResultsForStudents([student.id]),
    loadWellnessSignalsByStudentId(db, [student.id]),
  ]);
  const latestSurvey = latestSurveyByStudentId.get(student.id);
  const latestAssessment = student.studentAssessments[0] ?? null;
  const wellnessSignals = wellnessByStudentId.get(student.id) ?? [];

  return {
    id: student.id,
    studentId: formatStudentIdForResponse(student.studentId),
    name: student.name,
    image: getUserInitials(student.name, "นศ"),
    year: inferStudyYear(student.studentId, student.studyYear),
    riskLevel: normalizeRiskLevel(latestSurvey?.riskLevel ?? latestAssessment?.riskLevel ?? RiskLevel.NORMAL),
    lastAssessment: latestSurvey?.assessedAt ?? latestAssessment?.assessedAt ?? null,
    careRecordCount: student._count.studentCareRecords,
    behaviorRecordCount: student._count.studentBehaviorRecords,
    latestScore: latestSurvey?.totalScore ?? latestAssessment?.totalScore ?? null,
    latestInstrument: latestSurvey?.instrument ?? latestAssessment?.instrument ?? null,
    wellnessSignals,
    hasCrisisWellnessSignal: hasCrisisWellnessSignal(wellnessSignals),
  };
};
