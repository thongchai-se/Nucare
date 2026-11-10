import type { PrismaClient, WellnessTrendSignalCode } from "@prisma/client";
import {
  WELLNESS_TREND_SIGNAL_META,
  type WellnessTrendSignalCode as AppSignalCode,
} from "./student-chat/wellness-signals";

export type StudentWellnessSignalDto = {
  code: WellnessTrendSignalCode;
  labelTh: string;
  shortLabelTh: string;
  occurrenceCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
};

/** โหลดสรุปสัญญาณ wellness ของนิสิตหลายคนแบบ batch (O(n) ผ่าน Map) */
export const loadWellnessSignalsByStudentId = async (
  db: PrismaClient,
  studentIds: string[]
): Promise<Map<string, StudentWellnessSignalDto[]>> => {
  const result = new Map<string, StudentWellnessSignalDto[]>();
  if (studentIds.length === 0) {
    return result;
  }

  const rows = await db.studentWellnessTrendSummary.findMany({
    where: {
      studentId: { in: studentIds },
    },
    select: {
      studentId: true,
      signalCode: true,
      occurrenceCount: true,
      firstDetectedAt: true,
      lastDetectedAt: true,
    },
    orderBy: [{ lastDetectedAt: "desc" }, { signalCode: "asc" }],
  });

  for (const row of rows) {
    const meta = WELLNESS_TREND_SIGNAL_META[row.signalCode as AppSignalCode];
    const dto: StudentWellnessSignalDto = {
      code: row.signalCode,
      labelTh: meta?.labelTh ?? row.signalCode,
      shortLabelTh: meta?.shortLabelTh ?? row.signalCode,
      occurrenceCount: row.occurrenceCount,
      firstDetectedAt: row.firstDetectedAt.toISOString(),
      lastDetectedAt: row.lastDetectedAt.toISOString(),
    };
    const list = result.get(row.studentId);
    if (list) {
      list.push(dto);
    } else {
      result.set(row.studentId, [dto]);
    }
  }

  return result;
};

/** มีสัญญาณวิกฤตหรือไม่ */
export const hasCrisisWellnessSignal = (signals: StudentWellnessSignalDto[]): boolean =>
  signals.some((signal) => signal.code === "SELF_HARM_CRISIS");
