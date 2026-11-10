/**
 * ใส่ประวัติคำขอปรึกษา CLOSED จำนวนมากให้นิสิตทดสอบ — เช็ค UI ประวัติ + ปุ่มแสดงเพิ่ม
 * รัน: npx tsx scripts/seed-consultation-history-bulk.ts
 *
 * Login นิสิต: student.test@nucare.local / NucareTest!2026
 * หน้า: /student/advisor → ประวัติคำขอปรึกษา
 */
import "dotenv/config";
import {
  ConsultationPreferredChannel,
  ConsultationRequestStatus,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();
const MARKER = "[HISTORY-BULK]";
const COUNT = 18;

const TOPICS = [
  "การเรียนและผลการเรียน",
  "การฝึกปฏิบัติ/ขึ้นวอร์ด",
  "สุขภาพใจและความเครียด",
  "ทุนการศึกษาและค่าใช้จ่าย",
  "ความสัมพันธ์และครอบครัว",
  "การปรับตัวในมหาวิทยาลัย",
  "อื่น ๆ",
] as const;

async function findUser(email: string) {
  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    throw new Error(`ไม่พบผู้ใช้ ${email}`);
  }
  return user;
}

async function main() {
  const student = await findUser("student.test@nucare.local");
  const advisor = await findUser("advisor.test@nucare.local");

  const old = await prisma.consultationRequest.findMany({
    where: {
      studentId: student.id,
      note: { contains: MARKER },
    },
    select: { id: true },
  });
  if (old.length > 0) {
    const ids = old.map((row) => row.id);
    await prisma.consultationScheduleOffer.deleteMany({ where: { requestId: { in: ids } } });
    await prisma.consultationRequest.deleteMany({ where: { id: { in: ids } } });
    console.log(`ลบประวัติ bulk เก่า: ${old.length} รายการ`);
  }

  // ปิดคิวเปิดของนิสิตคนนี้ก่อน — ไม่ให้ชนกฎทีละรอบตอนดูประวัติ
  const closedOpen = await prisma.consultationRequest.updateMany({
    where: {
      studentId: student.id,
      status: {
        in: [
          ConsultationRequestStatus.PENDING,
          ConsultationRequestStatus.ACCEPTED,
          ConsultationRequestStatus.SCHEDULED,
        ],
      },
    },
    data: {
      status: ConsultationRequestStatus.CLOSED,
      closedAt: new Date(),
      advisorNote: `${MARKER} ปิดอัตโนมัติก่อนใส่ประวัติ bulk`,
    },
  });
  if (closedOpen.count > 0) {
    console.log(`ปิดคำขอเปิดค้างของนิสิต: ${closedOpen.count}`);
  }

  const now = Date.now();
  for (let index = 0; index < COUNT; index += 1) {
    const daysAgo = COUNT - index;
    const createdAt = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
    const closedAt = new Date(createdAt.getTime() + 6 * 60 * 60 * 1000);
    const topic = TOPICS[index % TOPICS.length];
    const online = index % 2 === 0;
    const hadSchedule = index % 3 === 0;

    await prisma.consultationRequest.create({
      data: {
        studentId: student.id,
        teacherId: advisor.id,
        topic,
        preferredChannel: online
          ? ConsultationPreferredChannel.ONLINE
          : ConsultationPreferredChannel.IN_PERSON,
        note: `${MARKER} #${index + 1} ประวัติตัวอย่างเพื่อเช็ค UI รายการยาว`,
        status: ConsultationRequestStatus.CLOSED,
        advisorNote:
          index % 4 === 0
            ? "พูดคุยเรียบร้อย ปิดคำขอ"
            : index % 4 === 1
              ? "นิสิตติดต่อช่องทางอื่นแล้ว"
              : null,
        acceptedAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
        scheduledAt: hadSchedule
          ? new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000)
          : null,
        scheduleLocation: hadSchedule
          ? online
            ? "Microsoft Teams (รอบที่ปิดแล้ว)"
            : "ห้องที่ปรึกษาชั้น 2"
          : null,
        closedAt,
        createdAt,
        updatedAt: closedAt,
      },
    });
  }

  const totalClosed = await prisma.consultationRequest.count({
    where: {
      studentId: student.id,
      status: ConsultationRequestStatus.CLOSED,
    },
  });

  console.log(`\nสร้าง CLOSED ใหม่: ${COUNT} รายการ (${MARKER})`);
  console.log(`CLOSED ทั้งหมดของ ${student.email}: ${totalClosed}`);
  console.log("Login: student.test@nucare.local / NucareTest!2026");
  console.log("เปิด /student/advisor → ก้อน「ประวัติคำขอปรึกษา」แล้วกดแสดงเพิ่ม");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
