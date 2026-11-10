/**
 * สร้างเคสคำขอปรึกษา + เจรจานัด ให้ อ.ดร. สุภาวดี (advisor.test) เช็ค UI/แจ้งเตือน
 * รัน: npx tsx scripts/seed-consultation-appointment-demo.ts
 *
 * กฎ: นิสิต 1 คนมีคำขอเปิดได้ทีละ 1 รายการ (PENDING|ACCEPTED|SCHEDULED)
 * จึงกระจายเคส active คนละคน + CLOSED เป็นประวัติ
 *
 * 1. s1 PENDING — รอรับ (+ กระดิ่ง)
 * 2. s2 ACCEPTED + ข้อเสนอจากนิสิต — รออาจารย์ตอบ (+ กระดิ่ง)
 * 3. s3 SCHEDULED — นัดยืนยันแล้ว
 * 4. s1 CLOSED — ประวัติปิดแล้ว (ไม่นับเป็น active)
 */
import "dotenv/config";
import {
  AlertPriority,
  AlertStatus,
  AlertType,
  ConsultationOfferStatus,
  ConsultationPreferredChannel,
  ConsultationRequestStatus,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();
const MARKER = "[DEMO-APPT]";

async function findUser(email: string) {
  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    select: { id: true, name: true, email: true, studentId: true },
  });
  if (!user) {
    throw new Error(`ไม่พบผู้ใช้ ${email}`);
  }
  return user;
}

/** ลบเคส demo/เทสเก่าของที่ปรึกษา + คำขอเปิดของนิสิตทดสอบทั้งชุด */
async function cleanupPreviousDemo(teacherId: string, studentIds: string[]) {
  const old = await prisma.consultationRequest.findMany({
    where: {
      OR: [
        {
          teacherId,
          OR: [
            { note: { contains: MARKER } },
            { note: { startsWith: "เทสนัดหมาย" } },
            { note: { startsWith: "เทสรับคำขอ" } },
            { note: { startsWith: "เทสปิดคำขอ" } },
            { note: { contains: "[NEGOTIATE-TEST" } },
          ],
        },
        {
          teacherId,
          studentId: { in: studentIds },
        },
      ],
    },
    select: { id: true, alertId: true },
  });
  if (old.length === 0) {
    return 0;
  }
  const alertIds = old.map((row) => row.alertId).filter((id): id is string => Boolean(id));
  const requestIds = old.map((row) => row.id);

  await prisma.consultationScheduleOffer.deleteMany({ where: { requestId: { in: requestIds } } });
  await prisma.consultationRequest.deleteMany({ where: { id: { in: requestIds } } });
  if (alertIds.length > 0) {
    await prisma.alert.deleteMany({ where: { id: { in: alertIds } } });
  }
  await prisma.alert.deleteMany({
    where: {
      recipientUserId: teacherId,
      sourceType: "ConsultationRequest",
      OR: [{ message: { contains: MARKER } }, { message: { contains: "เทส" } }],
    },
  });
  return old.length;
}

async function main() {
  const advisor = await findUser("advisor.test@nucare.local");
  const s1 = await findUser("student.test@nucare.local");
  const s2 = await findUser("student2.test@nucare.local");
  const s3 = await findUser("student3.test@nucare.local");

  const removed = await cleanupPreviousDemo(advisor.id, [s1.id, s2.id, s3.id]);
  // ปิดคำขอเปิดที่ค้างกับอาจารย์คนอื่นของนิสิตทดสอบ — ให้เหลือทีละรอบตามกฎใหม่
  const closedOther = await prisma.consultationRequest.updateMany({
    where: {
      studentId: { in: [s1.id, s2.id, s3.id] },
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
      advisorNote: `${MARKER} ปิดอัตโนมัติตอน seed (เคลียร์คิวเปิด)`,
    },
  });
  console.log(`ลบเคส demo/เทสเก่า: ${removed} รายการ · ปิดคิวเปิดค้าง: ${closedOther.count}`);
  console.log(`ปลายทาง: ${advisor.name} <${advisor.email}>`);

  const in5Days = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  type SeedRow = {
    label: string;
    student: typeof s1;
    topic: string;
    channel: ConsultationPreferredChannel;
    note: string;
    status: ConsultationRequestStatus;
    advisorNote?: string;
    scheduledAt?: Date;
    scheduleLocation?: string;
    acceptedAt?: Date;
    closedAt?: Date;
    offer?: {
      by: "ADVISOR" | "STUDENT";
      at: Date;
      location: string;
      note: string;
    };
    notifyAdvisor?: { title: string; message: string };
  };

  const rows: SeedRow[] = [
    {
      label: "1-PENDING รอรับ",
      student: s1,
      topic: "สุขภาพใจและความเครียด",
      channel: ConsultationPreferredChannel.IN_PERSON,
      note: `${MARKER} รอรับคำขอ — เช็คการ์ด «รอรับ» และกระดิ่งแจ้งเตือน`,
      status: ConsultationRequestStatus.PENDING,
      notifyAdvisor: {
        title: "นักศึกษาขอรับคำปรึกษา",
        message: `นักศึกษา: ${s1.name}\nประเด็น: สุขภาพใจและความเครียด\n${MARKER} รอรับ`,
      },
    },
    {
      label: "2-รอ ADVISOR ตอบ (นิสิตขอเปลี่ยน)",
      student: s2,
      topic: "การปรับตัวในมหาวิทยาลัย",
      channel: ConsultationPreferredChannel.ONLINE,
      note: `${MARKER} นิสิตขอเปลี่ยนวัน/ที่ — รออาจารย์ยอมรับหรือเสนอใหม่`,
      status: ConsultationRequestStatus.ACCEPTED,
      advisorNote: "เคยเสนอครั้งหนึ่ง นิสิตขอเปลี่ยน",
      acceptedAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      offer: {
        by: "STUDENT",
        at: in5Days,
        location: "ออนไลน์ Microsoft Teams",
        note: "ขอเลื่อนเป็นช่วงเย็น",
      },
      notifyAdvisor: {
        title: "นิสิตขอเปลี่ยนวัน/สถานที่นัด",
        message: `การปรับตัวในมหาวิทยาลัย · ออนไลน์ Microsoft Teams · ${MARKER}`,
      },
    },
    {
      label: "3-SCHEDULED นัดยืนยัน",
      student: s3,
      topic: "ความสัมพันธ์และครอบครัว",
      channel: ConsultationPreferredChannel.IN_PERSON,
      note: `${MARKER} นัดยืนยันแล้ว — การ์ด «นัดหมายแล้ว»`,
      status: ConsultationRequestStatus.SCHEDULED,
      advisorNote: "ยืนยันนัดทั้งสองฝ่ายแล้ว",
      acceptedAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
      scheduledAt: in7Days,
      scheduleLocation: "ห้องที่ปรึกษาชั้น 2",
    },
    {
      label: "4-CLOSED ปิดแล้ว (ประวัติ)",
      student: s1,
      topic: "อื่น ๆ",
      channel: ConsultationPreferredChannel.ONLINE,
      note: `${MARKER} ปิดคำขอแล้ว — การ์ด «ปิดแล้ว»`,
      status: ConsultationRequestStatus.CLOSED,
      advisorNote: "พูดคุยจบแล้ว ปิดคำขอ",
      acceptedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  ];

  const created: Array<{ label: string; id: string; status: string; waitingOn?: string }> = [];

  for (const row of rows) {
    const alert = row.notifyAdvisor
      ? await prisma.alert.create({
          data: {
            recipientUserId: advisor.id,
            actorUserId: row.student.id,
            studentId: row.student.id,
            type: AlertType.ADVISOR_FOLLOW_UP,
            priority: AlertPriority.MEDIUM,
            status: AlertStatus.OPEN,
            title: row.notifyAdvisor.title,
            message: row.notifyAdvisor.message,
            sourceType: "ConsultationRequest",
          },
        })
      : null;

    const request = await prisma.consultationRequest.create({
      data: {
        studentId: row.student.id,
        teacherId: advisor.id,
        alertId: alert?.id,
        topic: row.topic,
        preferredChannel: row.channel,
        note: row.note,
        status: row.status,
        advisorNote: row.advisorNote ?? null,
        scheduledAt: row.scheduledAt ?? null,
        scheduleLocation: row.scheduleLocation ?? null,
        acceptedAt: row.acceptedAt ?? null,
        closedAt: row.closedAt ?? null,
      },
    });

    if (alert) {
      await prisma.alert.update({
        where: { id: alert.id },
        data: { sourceId: request.id },
      });
    }

    let waitingOn: string | undefined;
    if (row.offer) {
      const proposedById = row.offer.by === "ADVISOR" ? advisor.id : row.student.id;
      waitingOn = row.offer.by === "ADVISOR" ? "STUDENT" : "ADVISOR";
      await prisma.consultationScheduleOffer.create({
        data: {
          requestId: request.id,
          proposedById,
          proposedAt: row.offer.at,
          location: row.offer.location,
          note: row.offer.note,
          status: ConsultationOfferStatus.PENDING,
        },
      });
    }

    created.push({ label: row.label, id: request.id, status: row.status, waitingOn });
    console.log(`OK  ${row.label} · ${row.student.name} · ${request.id}${waitingOn ? ` · รอ${waitingOn}` : ""}`);
  }

  const openAlerts = await prisma.alert.count({
    where: {
      recipientUserId: advisor.id,
      status: AlertStatus.OPEN,
      message: { contains: MARKER },
    },
  });

  console.log("\n--- สรุปสำหรับเช็คบนเว็บ ---");
  console.log("Login: advisor.test@nucare.local / NucareTest!2026");
  console.log("เมนู: คำขอปรึกษา → กดการ์ดสถานะทีละใบ");
  console.log(`แจ้งเตือน OPEN ที่เกี่ยวกับ demo: ${openAlerts} รายการ (กระดิ่ง)`);
  for (const item of created) {
    console.log(`- ${item.label}${item.waitingOn ? ` (รอ ${item.waitingOn})` : ""}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
