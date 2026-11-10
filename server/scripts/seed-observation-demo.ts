/**
 * สร้างข้อสังเกตตัวอย่างครบทุกรูปแบบให้ลองเช็ค UI/สถานะ
 * กฎ: ผู้แจ้งต้องไม่ใช่ที่ปรึกษาของนิสิตคนนั้น — สัญญาณเข้าที่ปรึกษาของนิสิต
 * รัน: npx tsx scripts/seed-observation-demo.ts
 *
 * หมายเหตุ: ถ้าเคยรัน walkthrough ที่ผูก peer เป็นที่ปรึกษาแล้ว
 * ใช้ multi.all-staff เป็นผู้แจ้งแทน peer
 */
import "dotenv/config";
import { AlertStatus, BehaviorSeverity, PrismaClient } from "@prisma/client";
import { createStudentObservation } from "../src/lib/behavior-observation";

const prisma = new PrismaClient();

type DemoCase = {
  reporterEmail: string;
  studentEmail: string;
  category: string;
  details: string;
  severity: BehaviorSeverity;
  daysAgo: number;
  followUp: "PENDING" | "ACKNOWLEDGED" | "COMPLETED";
};

const cases: DemoCase[] = [
  {
    reporterEmail: "multi.all-staff@nucare.local",
    studentEmail: "student.test@nucare.local",
    category: "ขาดเรียน/ฝึกงานบ่อย",
    details: "ขาดเรียนภาคทฤษฎี 3 สัปดาห์ติดต่อกัน โดยไม่แจ้งล่วงหน้า",
    severity: BehaviorSeverity.MEDIUM,
    daysAgo: 0,
    followUp: "PENDING",
  },
  {
    reporterEmail: "multi.all-staff@nucare.local",
    studentEmail: "student2.test@nucare.local",
    category: "ซึมเศร้า/ร้องไห้บ่อย",
    details: "ในคาบเรียนดูเหม่อลอย น้ำตาซึมเมื่อถูกถามงานกลุ่ม",
    severity: BehaviorSeverity.HIGH,
    daysAgo: 1,
    followUp: "PENDING",
  },
  {
    reporterEmail: "multi.all-staff@nucare.local",
    studentEmail: "student3.test@nucare.local",
    category: "ผลการเรียนตกลงมาก",
    details: "คะแนนสอบกลางภาคตกลงชัดจากครั้งก่อน ดูเครียดเรื่องการบ้าน",
    severity: BehaviorSeverity.LOW,
    daysAgo: 2,
    followUp: "ACKNOWLEDGED",
  },
  {
    reporterEmail: "advisor.peer@nucare.local",
    studentEmail: "student.test@nucare.local",
    category: "มีปัญหาความสัมพันธ์",
    details: "มีปากเสียงกับเพื่อนในกลุ่มฝึกงาน บรรยากาศตึงเครียด",
    severity: BehaviorSeverity.MEDIUM,
    daysAgo: 3,
    followUp: "ACKNOWLEDGED",
  },
  {
    reporterEmail: "advisor.peer@nucare.local",
    studentEmail: "student2.test@nucare.local",
    category: "นอนไม่หลับ/เหนื่อยล้า",
    details: "บอกว่านอนดึกต่อเนื่องและอ่อนเพลียระหว่างฝึกภาคปฏิบัติ",
    severity: BehaviorSeverity.HIGH,
    daysAgo: 5,
    followUp: "COMPLETED",
  },
  {
    reporterEmail: "advisor.peer@nucare.local",
    studentEmail: "student3.test@nucare.local",
    category: "แยกตัวจากกลุ่ม",
    details: "ไม่ร่วมกิจกรรมกลุ่มและนั่งคนเดียวหลังเลิกเรียนบ่อยขึ้น",
    severity: BehaviorSeverity.LOW,
    daysAgo: 7,
    followUp: "COMPLETED",
  },
];

async function findUser(email: string) {
  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) {
    throw new Error(`ไม่พบบัญชี ${email}`);
  }
  return user;
}

async function isOwnAdvisee(advisorId: string, studentId: string) {
  const row = await prisma.studentAdvisorAssignment.findFirst({
    where: { advisorId, studentId, isActive: true },
    select: { id: true },
  });
  return Boolean(row);
}

async function applyFollowUp(behaviorRecordId: string, followUp: DemoCase["followUp"]) {
  if (followUp === "PENDING") {
    return;
  }

  const status = followUp === "ACKNOWLEDGED" ? AlertStatus.ACKNOWLEDGED : AlertStatus.CLOSED;
  await prisma.alert.updateMany({
    where: {
      sourceType: "BehaviorRecord",
      sourceId: behaviorRecordId,
    },
    data: { status },
  });
}

async function main() {
  const reporterEmails = [...new Set(cases.map((item) => item.reporterEmail))];
  const reporters = await prisma.user.findMany({
    where: { email: { in: reporterEmails } },
    select: { id: true },
  });
  const reporterIds = reporters.map((item) => item.id);

  const oldRecords = await prisma.behaviorRecord.findMany({
    where: { instructorId: { in: reporterIds } },
    select: { id: true },
  });
  const oldIds = oldRecords.map((item) => item.id);
  if (oldIds.length > 0) {
    await prisma.alert.deleteMany({
      where: { sourceType: "BehaviorRecord", sourceId: { in: oldIds } },
    });
    await prisma.behaviorRecord.deleteMany({ where: { id: { in: oldIds } } });
  }

  let created = 0;
  let skipped = 0;

  for (const item of cases) {
    const reporter = await findUser(item.reporterEmail);
    const student = await findUser(item.studentEmail);

    if (await isOwnAdvisee(reporter.id, student.id)) {
      console.log(
        `ข้าม: ${reporter.email} เป็นที่ปรึกษาของ ${student.email} อยู่แล้ว — แจ้งข้อสังเกตไม่ได้`
      );
      skipped += 1;
      continue;
    }

    const result = await createStudentObservation({
      reporterUserId: reporter.id,
      studentId: student.id,
      category: item.category,
      details: item.details,
      severity: item.severity,
      observedAt: new Date(Date.now() - item.daysAgo * 24 * 60 * 60 * 1000),
    });
    await applyFollowUp(result.behaviorRecord.id, item.followUp);
    created += 1;
    console.log(
      `OK ${item.followUp.padEnd(12)} · ${reporter.name} → ${student.name} · สัญญาณ ${result.notifiedAdvisorCount} คน · ${item.category}`
    );
  }

  console.log(`\nสร้าง ${created} รายการ · ข้าม ${skipped} (own advisee)`);
  console.log("Login ที่ปรึกษาของนิสิต (เช่น advisor.test / peer หลัง walkthrough) → เมนู สัญญาณเข้า");
  console.log("ผู้แจ้ง (เช่น multi.all-staff / peer ถ้ายังไม่ถูกผูก) → เมนู ข้อสังเกตที่แจ้ง");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
