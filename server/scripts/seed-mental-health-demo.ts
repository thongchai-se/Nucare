/**
 * ล้างคิว/เคสสุขภาพจิตเก่า แล้ว seed ชุดครบสำหรับ mh.test@nucare.local
 * รัน: npx tsx scripts/seed-mental-health-demo.ts
 *
 * Login: mh.test@nucare.local / NucareTest!2026
 * เมนู: คิวและเคส · รายการส่งต่อ · ปฏิทินนัดหมาย · หน้าหลัก
 */
import "dotenv/config";
import {
  AlertPriority,
  AlertStatus,
  AlertType,
  AssessmentInstrument,
  EmergencyCaseStatus,
  MentalHealthAppointmentStatus,
  PrismaClient,
  ReferralStatus,
  ReferralTarget,
  RiskLevel,
} from "@prisma/client";

const prisma = new PrismaClient();
const MARKER = "[MH-DEMO]";
const EXEC_TREND_MARKER = "[EXEC-TREND]";

async function findUser(email: string) {
  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    select: { id: true, name: true, email: true, studentId: true },
  });
  if (!user) {
    throw new Error(`ไม่พบผู้ใช้ ${email} — รัน seed-local-test-accounts.ts ก่อน`);
  }
  return user;
}

/** ลบ referral ศูนย์ให้คำปรึกษา + นัด/บันทึก/SOS/แจ้งเตือนที่เกี่ยวกับชุด demo และค้างเก่า */
async function cleanupMentalHealthQueue(mhUserId: string, studentIds: string[]) {
  const counselingReferrals = await prisma.caseReferral.findMany({
    where: {
      OR: [
        { target: ReferralTarget.COUNSELING_CENTER, studentId: { in: studentIds } },
        { reason: { contains: MARKER } },
        { reason: { contains: EXEC_TREND_MARKER }, target: ReferralTarget.COUNSELING_CENTER },
        { reason: { contains: "[TEST]" }, target: ReferralTarget.COUNSELING_CENTER },
      ],
    },
    select: { id: true },
  });
  const referralIds = counselingReferrals.map((row) => row.id);

  if (referralIds.length > 0) {
    await prisma.mentalHealthAppointment.deleteMany({
      where: {
        OR: [{ referralId: { in: referralIds } }, { note: { contains: MARKER } }],
      },
    });
    await prisma.specializedCareRecord.deleteMany({
      where: {
        OR: [
          { referralId: { in: referralIds } },
          { summary: { contains: MARKER } },
          { interventionPlan: { contains: MARKER } },
        ],
      },
    });
    await prisma.caseReferral.deleteMany({ where: { id: { in: referralIds } } });
  }

  await prisma.mentalHealthAppointment.deleteMany({
    where: {
      OR: [
        { mentalHealthUserId: mhUserId, studentId: { in: studentIds } },
        { note: { contains: MARKER } },
      ],
    },
  });

  await prisma.specializedCareRecord.deleteMany({
    where: {
      OR: [
        { mentalHealthUserId: mhUserId, studentId: { in: studentIds } },
        { summary: { contains: MARKER } },
      ],
    },
  });

  await prisma.emergencyCase.deleteMany({
    where: {
      OR: [
        { studentId: { in: studentIds }, summary: { contains: MARKER } },
        { summary: { contains: EXEC_TREND_MARKER } },
        { studentId: { in: studentIds }, status: { in: [EmergencyCaseStatus.OPEN, EmergencyCaseStatus.IN_PROGRESS] } },
      ],
    },
  });

  await prisma.alert.deleteMany({
    where: {
      recipientUserId: mhUserId,
      OR: [
        { type: AlertType.REFERRAL_RECEIVED },
        { type: AlertType.SOS_OPENED },
        { message: { contains: MARKER } },
        { title: { contains: MARKER } },
      ],
    },
  });

  return referralIds.length;
}

async function main() {
  const mh = await findUser("mh.test@nucare.local");
  const advisor = await findUser("advisor.test@nucare.local");
  const s1 = await findUser("student.test@nucare.local");
  const s2 = await findUser("student2.test@nucare.local");
  const s3 = await findUser("student3.test@nucare.local");
  const students = [s1, s2, s3];

  const removed = await cleanupMentalHealthQueue(
    mh.id,
    students.map((row) => row.id)
  );
  console.log(`ล้าง referral ศูนย์ให้คำปรึกษา/คิวเก่า: ${removed} รายการ`);
  console.log(`ผู้เชี่ยวชาญ: ${mh.name} <${mh.email}>`);

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  // ประวัติปิดแล้ว (คนละรอบก่อนคิวปัจจุบัน) — ใช้ดูไทม์ไลน์ได้
  for (const [index, student] of students.entries()) {
    const closedAt = daysAgo(20 - index * 3);
    const closedReferral = await prisma.caseReferral.create({
      data: {
        studentId: student.id,
        advisorId: advisor.id,
        target: ReferralTarget.COUNSELING_CENTER,
        reason: `${MARKER} ประวัติรอบก่อน — ติดตามความเครียดจากการเรียน (${student.name})`,
        isUrgent: false,
        status: ReferralStatus.CLOSED,
        createdAt: daysAgo(28 - index * 3),
        updatedAt: closedAt,
      },
    });

    await prisma.specializedCareRecord.create({
      data: {
        studentId: student.id,
        mentalHealthUserId: mh.id,
        referralId: closedReferral.id,
        sessionDate: daysAgo(22 - index * 3),
        summary: `${MARKER}\nS: เล่าเรื่องเครียดสอบ\nO: สีหน้ากังวล นอนไม่หลับ\nA: ความเครียดระดับปานกลาง`,
        interventionPlan: `${MARKER}\nP: ฝึกหายใจ ติดตาม 2 สัปดาห์`,
        confidentialNotes: `${MARKER} บันทึกลับรอบก่อนของ ${student.name}`,
        createdAt: daysAgo(22 - index * 3),
      },
    });

    await prisma.mentalHealthAppointment.create({
      data: {
        studentId: student.id,
        mentalHealthUserId: mh.id,
        referralId: closedReferral.id,
        scheduledAt: daysAgo(22 - index * 3),
        location: "ห้องให้คำปรึกษา 1",
        note: `${MARKER} นัดรอบก่อน (พบแล้ว)`,
        status: MentalHealthAppointmentStatus.COMPLETED,
        createdAt: daysAgo(25 - index * 3),
      },
    });

    await prisma.studentAssessment.create({
      data: {
        studentId: student.id,
        instrument: AssessmentInstrument.Q9,
        totalScore: 8 + index * 3,
        riskLevel: index === 0 ? RiskLevel.HIGH : index === 1 ? RiskLevel.MEDIUM : RiskLevel.NORMAL,
        assessedAt: daysAgo(15 - index),
      },
    });
  }

  // คิวปัจจุบัน — เปิดได้คนละ 1 รายการตามกฎ active referral
  const pending = await prisma.caseReferral.create({
    data: {
      studentId: s1.id,
      advisorId: advisor.id,
      target: ReferralTarget.COUNSELING_CENTER,
      reason: `${MARKER} ส่งต่อเร่งด่วน — นอนไม่หลับ ซึมเศร้า มีความคิดท้อแท้ ต้องการประเมินโดยผู้เชี่ยวชาญ`,
      isUrgent: true,
      status: ReferralStatus.PENDING,
      createdAt: daysAgo(1),
    },
  });

  const acceptedWithAppt = await prisma.caseReferral.create({
    data: {
      studentId: s2.id,
      advisorId: advisor.id,
      acceptedByUserId: mh.id,
      target: ReferralTarget.COUNSELING_CENTER,
      reason: `${MARKER} ส่งต่อเพื่อติดตามหลังคัดกรองเสี่ยงปานกลาง — นัดคุยและบันทึกผล`,
      isUrgent: false,
      status: ReferralStatus.ACCEPTED,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(4),
    },
  });

  const acceptedNeedAppt = await prisma.caseReferral.create({
    data: {
      studentId: s3.id,
      advisorId: advisor.id,
      acceptedByUserId: mh.id,
      target: ReferralTarget.COUNSELING_CENTER,
      reason: `${MARKER} ส่งต่อเพื่อให้คำปรึกษาเรื่องปรับตัวชั้นปี 1 — รับแล้วรอสร้างนัด`,
      isUrgent: false,
      status: ReferralStatus.ACCEPTED,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
  });

  // นัด + บันทึกของเคสที่รับแล้ว (s2)
  await prisma.mentalHealthAppointment.create({
    data: {
      studentId: s2.id,
      mentalHealthUserId: mh.id,
      referralId: acceptedWithAppt.id,
      scheduledAt: daysAhead(2),
      location: "ห้องให้คำปรึกษา 2",
      note: `${MARKER} นัดติดตามอาการ — นำผลการประเมินมาด้วย`,
      status: MentalHealthAppointmentStatus.SCHEDULED,
    },
  });
  await prisma.mentalHealthAppointment.create({
    data: {
      studentId: s2.id,
      mentalHealthUserId: mh.id,
      referralId: acceptedWithAppt.id,
      scheduledAt: daysAgo(2),
      location: "ออนไลน์ (Microsoft Teams)",
      note: `${MARKER} นัดรอบแรก (พบแล้ว)`,
      status: MentalHealthAppointmentStatus.COMPLETED,
    },
  });
  await prisma.specializedCareRecord.create({
    data: {
      studentId: s2.id,
      mentalHealthUserId: mh.id,
      referralId: acceptedWithAppt.id,
      sessionDate: daysAgo(2),
      summary: `${MARKER}\nS: กังวลเรื่องฝึกงานและความสัมพันธ์ในกลุ่ม\nO: พูดช้า น้ำตาคลอ\nA: ความเครียดปานกลาง ยังไม่พบสัญญาณอันตรายต่อตนเอง`,
      interventionPlan: `${MARKER}\nP: นัดติดตาม 1 สัปดาห์ · แนะนำเทคนิค grounding`,
      confidentialNotes: `${MARKER} บันทึกลับ — ประวัติครอบครัวอ่อนไหว`,
    },
  });

  // บันทึกเริ่มต้นของ s3 (รับแล้ว ยังไม่มีนัดถัดไป)
  await prisma.specializedCareRecord.create({
    data: {
      studentId: s3.id,
      mentalHealthUserId: mh.id,
      referralId: acceptedNeedAppt.id,
      sessionDate: daysAgo(1),
      summary: `${MARKER}\nS: ปรับตัวชั้นปี 1 ยาก นอนดึก\nO: สุภาพ ร่วมมือดี\nA: ปัญหาปรับตัว ระดับน้อย-ปานกลาง`,
      interventionPlan: `${MARKER}\nP: สร้างนัดพบตัวสัปดาห์หน้า · ให้ใบงานนอน`,
      confidentialNotes: null,
    },
  });

  // แจ้งเตือนคิวส่งต่อให้ mh (SOS ฝั่งสตาฟพักไว้ — ไม่ seed)
  await prisma.alert.create({
    data: {
      recipientUserId: mh.id,
      actorUserId: advisor.id,
      studentId: s1.id,
      type: AlertType.REFERRAL_RECEIVED,
      priority: AlertPriority.HIGH,
      title: `${MARKER} มีเคสส่งต่อเร่งด่วน`,
      message: pending.reason,
      status: AlertStatus.OPEN,
      sourceType: "CaseReferral",
      sourceId: pending.id,
    },
  });

  // ตรวจว่า history endpoint โหลดได้จริง
  const { getMentalHealthStudentHistoryByReferral } = await import(
    "../src/lib/mental-health-student-history"
  );
  for (const referral of [pending, acceptedWithAppt, acceptedNeedAppt]) {
    const history = await getMentalHealthStudentHistoryByReferral(prisma, mh.id, referral.id);
    if (history === "forbidden" || history === "not_found") {
      throw new Error(`โหลดประวัติ referral ${referral.id} ไม่สำเร็จ: ${history}`);
    }
    console.log(
      `ตรวจประวัติ OK · ${history.student.name} · บันทึก ${history.careSessions.length} · นัด ${history.appointments.length} · กิจกรรม ${history.activity.length}`
    );
  }

  console.log("\nสรุปเคสที่ seed:");
  console.log(`- PENDING (เร่งด่วน): ${s1.name}`);
  console.log(`- ACCEPTED + นัดแล้ว + บันทึกผล: ${s2.name}`);
  console.log(`- ACCEPTED รอสร้างนัด: ${s3.name}`);
  console.log("- แจ้งเตือนคิวส่งต่อบนแดชบอร์ด (SOS ฝั่งสตาฟพักไว้)");
  console.log("- ประวัติปิดแล้วครบทั้ง 3 คน (ดูในแท็บไทม์ไลน์/บันทึกผล)");
  console.log("\nLogin: mh.test@nucare.local / NucareTest!2026 → เมนู คิวและเคส");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
