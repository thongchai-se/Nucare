import { Prisma, PrismaClient, WellnessTrendSignalCode as DbSignalCode } from "@prisma/client";
import { notifyAdvisorsOfWellnessSignals } from "./notify-advisors-of-wellness";
import {
  detectWellnessTrendSignals,
  type WellnessTrendSignalCode,
} from "./wellness-signals";

export const WELLNESS_TREND_SOURCE_STUDENT_CHAT = "STUDENT_CHAT";

type RecordResult = {
  recordedCodes: WellnessTrendSignalCode[];
};

const toDbCode = (code: WellnessTrendSignalCode): DbSignalCode => code as DbSignalCode;

/**
 * บันทึกเฉพาะรหัสแนวโน้มจากข้อความแชท (ไม่เก็บเนื้อหา) และอัปเดตสรุปจำนวนครั้ง
 */
export const recordWellnessTrendsFromChatMessage = async (
  prisma: PrismaClient,
  studentId: string,
  messageContent: string
): Promise<RecordResult> => {
  const codes = detectWellnessTrendSignals(messageContent);
  if (codes.length === 0) {
    return { recordedCodes: [] };
  }

  const now = new Date();

  await prisma.$transaction(
    codes.flatMap((code) => {
      const dbCode = toDbCode(code);
      return [
        prisma.studentWellnessTrendHit.create({
          data: {
            studentId,
            signalCode: dbCode,
            source: WELLNESS_TREND_SOURCE_STUDENT_CHAT,
            detectedAt: now,
          },
        }),
        prisma.studentWellnessTrendSummary.upsert({
          where: {
            studentId_signalCode: {
              studentId,
              signalCode: dbCode,
            },
          },
          create: {
            studentId,
            signalCode: dbCode,
            occurrenceCount: 1,
            firstDetectedAt: now,
            lastDetectedAt: now,
          },
          update: {
            occurrenceCount: { increment: 1 },
            lastDetectedAt: now,
          },
        }),
      ];
    }) as Prisma.PrismaPromise<unknown>[]
  );

  try {
    await notifyAdvisorsOfWellnessSignals(prisma, studentId, codes);
  } catch (error) {
    console.error("notifyAdvisorsOfWellnessSignals error:", error);
  }

  return { recordedCodes: codes };
};
