import { Prisma, SurveyStatus, SurveyWaveStatus } from "@prisma/client";
import { prisma } from "./prisma";

export type AssignmentStatus = "completed" | "pending" | "overdue";

/**
 * สรุปสถานะ assignment: ทำแล้ว = completed; ยังไม่ทำและคลื่นหมดเวลา/ปิด/ยกเลิก = overdue; นอกนั้น pending
 * (pure function ไม่แตะฐานข้อมูล)
 */
export function deriveAssignmentStatus(input: {
  completedAt: Date | null | undefined;
  closesAt: Date | null | undefined;
  waveStatus: SurveyWaveStatus;
  now?: Date;
}): AssignmentStatus {
  if (input.completedAt) {
    return "completed";
  }
  if (
    input.waveStatus === SurveyWaveStatus.CLOSED ||
    input.waveStatus === SurveyWaveStatus.CANCELLED
  ) {
    return "overdue";
  }
  const now = input.now ?? new Date();
  if (input.closesAt && input.closesAt.getTime() < now.getTime()) {
    return "overdue";
  }
  return "pending";
}

/** ซิงก์ isActive/startsAt/endsAt ของ Survey จากคลื่นที่ OPEN ล่าสุดของแบบนั้นเท่านั้น (ไม่แตะแบบอื่น) */
export async function syncSurveyActiveFromWaves(
  tx: Prisma.TransactionClient,
  surveyId: string
): Promise<void> {
  const openWave = await tx.surveyWave.findFirst({
    where: { surveyId, status: SurveyWaveStatus.OPEN },
    orderBy: { opensAt: "desc" },
  });

  await tx.survey.update({
    where: { id: surveyId },
    data: {
      isActive: Boolean(openWave),
      startsAt: openWave?.opensAt ?? null,
      endsAt: openWave?.closesAt ?? null,
      status: openWave ? SurveyStatus.PUBLISHED : undefined,
    },
  });
}

/**
 * ปิดคลื่นที่ OPEN แต่เลย closesAt แล้ว (CLOSED) และซิงก์ isActive ของแบบประเมินที่เกี่ยวข้อง
 * คืนจำนวนคลื่นที่ถูกปิด; ใช้ 1 query ค้นหา + 1 transaction รวม (ไม่ N+1 ต่อคลื่น)
 */
export async function closeExpiredOpenWaves(now: Date = new Date()): Promise<number> {
  const expired = await prisma.surveyWave.findMany({
    where: { status: SurveyWaveStatus.OPEN, closesAt: { lt: now } },
    select: { id: true, surveyId: true },
  });
  if (expired.length === 0) {
    return 0;
  }

  const waveIds = expired.map((wave) => wave.id);
  const surveyIds = [...new Set(expired.map((wave) => wave.surveyId))];

  await prisma.$transaction(async (tx) => {
    await tx.surveyWave.updateMany({
      where: { id: { in: waveIds }, status: SurveyWaveStatus.OPEN },
      data: { status: SurveyWaveStatus.CLOSED },
    });
    for (const surveyId of surveyIds) {
      await syncSurveyActiveFromWaves(tx, surveyId);
    }
  });

  return expired.length;
}
