/**
 * ใส่ข้อมูลจำลองสำหรับกราฟแนวโน้มผู้บริหาร (6 เดือนล่าสุด)
 * — StudentAssessment กระจายรายเดือน + referral/SOS บางส่วน
 *
 * รัน: npx tsx scripts/seed-executive-trends.ts
 * ดูที่: /executive?view=trends
 * Login: executive.test@nucare.local / NucareTest!2026
 */
import "dotenv/config";
import {
  AssessmentInstrument,
  EmergencyCaseStatus,
  PrismaClient,
  ReferralStatus,
  ReferralTarget,
  RiskLevel,
  Role,
} from "@prisma/client";

const prisma = new PrismaClient();
const MARKER = "[EXEC-TREND]";
const MONTHS = 6;
/** คะแนน 9000+ ใช้เป็น marker ของชุด seed นี้ */
const SCORE_MARKER_MIN = 9000;

const RISK_CYCLE: RiskLevel[] = [
  RiskLevel.NORMAL,
  RiskLevel.MEDIUM,
  RiskLevel.HIGH,
  RiskLevel.NORMAL,
  RiskLevel.HIGH,
  RiskLevel.MEDIUM,
];

async function main() {
  const students = await prisma.user.findMany({
    where: { role: Role.STUDENT, isActive: true },
    select: { id: true, name: true, studyYear: true, studentId: true },
    orderBy: [{ studyYear: "asc" }, { createdAt: "asc" }],
    take: 40,
  });

  if (students.length === 0) {
    throw new Error("ไม่พบนิสิตสำหรับใส่ข้อมูลแนวโน้ม");
  }

  const advisor = await prisma.user.findFirst({
    where: { email: "advisor.test@nucare.local", isActive: true },
    select: { id: true },
  });
  if (!advisor) {
    throw new Error("ไม่พบ advisor.test@nucare.local");
  }

  const seededAssessments = await prisma.studentAssessment.findMany({
    where: { totalScore: { gte: SCORE_MARKER_MIN } },
    select: { id: true },
  });
  if (seededAssessments.length > 0) {
    const ids = seededAssessments.map((row) => row.id);
    await prisma.assessmentAnswer.deleteMany({ where: { assessmentId: { in: ids } } });
    await prisma.studentAssessment.deleteMany({ where: { id: { in: ids } } });
    console.log(`ลบ assessment จำลองเก่า: ${ids.length}`);
  }

  const oldReferrals = await prisma.caseReferral.findMany({
    where: { reason: { contains: MARKER } },
    select: { id: true },
  });
  if (oldReferrals.length > 0) {
    await prisma.caseReferral.deleteMany({ where: { id: { in: oldReferrals.map((row) => row.id) } } });
    console.log(`ลบ referral จำลองเก่า: ${oldReferrals.length}`);
  }

  const oldEmergencies = await prisma.emergencyCase.findMany({
    where: { summary: { contains: MARKER } },
    select: { id: true },
  });
  if (oldEmergencies.length > 0) {
    await prisma.emergencyCase.deleteMany({ where: { id: { in: oldEmergencies.map((row) => row.id) } } });
    console.log(`ลบ SOS จำลองเก่า: ${oldEmergencies.length}`);
  }

  const now = new Date();
  let assessmentCount = 0;
  let referralCount = 0;
  let sosCount = 0;

  for (let offset = MONTHS - 1; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 12, 10, 0, 0);
    const screenedThisMonth = Math.min(students.length, 8 + ((MONTHS - offset) % 4) * 3);
    const highRiskTarget = Math.max(2, Math.floor(screenedThisMonth * 0.3));

    for (let index = 0; index < screenedThisMonth; index += 1) {
      const student = students[index % students.length];
      if (!student) {
        continue;
      }

      const isHigh = index < highRiskTarget;
      const riskLevel = isHigh ? RiskLevel.HIGH : RISK_CYCLE[(index + offset) % RISK_CYCLE.length];
      const day = 5 + (index % 18);
      const assessedAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, 9 + (index % 6), 15);

      await prisma.studentAssessment.create({
        data: {
          studentId: student.id,
          instrument: AssessmentInstrument.Q9,
          totalScore: SCORE_MARKER_MIN + offset * 100 + index,
          riskLevel,
          assessedAt,
        },
      });
      assessmentCount += 1;
    }

    const caseCount = 2 + (offset % 3);
    for (let index = 0; index < caseCount; index += 1) {
      const student = students[(index * 3 + offset) % students.length];
      if (!student) {
        continue;
      }
      const openedAt = new Date(monthDate.getFullYear(), monthDate.getMonth(), 8 + index * 4, 14, 0, 0);

      await prisma.caseReferral.create({
        data: {
          studentId: student.id,
          advisorId: advisor.id,
          target: ReferralTarget.COUNSELING_CENTER,
          reason: `${MARKER} จำลองแนวโน้มเดือน ${monthDate.getMonth() + 1}`,
          status: index === 0 ? ReferralStatus.PENDING : ReferralStatus.CLOSED,
          createdAt: openedAt,
          updatedAt: openedAt,
        },
      });
      referralCount += 1;

      if (index === 0) {
        await prisma.emergencyCase.create({
          data: {
            studentId: student.id,
            reportedByUserId: advisor.id,
            summary: `${MARKER} จำลอง SOS เดือน ${monthDate.getMonth() + 1}`,
            status: EmergencyCaseStatus.RESOLVED,
            openedAt,
            resolvedAt: new Date(openedAt.getTime() + 36 * 60 * 60 * 1000),
            createdAt: openedAt,
            updatedAt: openedAt,
          },
        });
        sosCount += 1;
      }
    }
  }

  console.log(`สร้าง assessment: ${assessmentCount}`);
  console.log(`สร้าง referral: ${referralCount}`);
  console.log(`สร้าง SOS: ${sosCount}`);
  console.log("เปิด /executive?view=trends (executive.test@nucare.local / NucareTest!2026)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
