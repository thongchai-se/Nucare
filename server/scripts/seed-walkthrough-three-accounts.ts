/**
 * Seed ครบ flow สำหรับลองเองด้วย 3 บัญชีหลัก
 * - student.test@nucare.local
 * - advisor.peer@nucare.local  (ผูกเป็นที่ปรึกษาของนิสิตทดสอบทั้ง 3)
 * - mh.test@nucare.local
 *
 * รัน: npx tsx scripts/seed-walkthrough-three-accounts.ts
 * รหัสผ่าน: NucareTest!2026
 */
import "dotenv/config";
import {
  AlertPriority,
  AlertStatus,
  AlertType,
  AssessmentInstrument,
  BehaviorSeverity,
  ConsultationOfferStatus,
  ConsultationPreferredChannel,
  ConsultationRequestStatus,
  EmergencyCaseStatus,
  MentalHealthAppointmentStatus,
  PrismaClient,
  ReferralStatus,
  ReferralTarget,
  RiskLevel,
} from "@prisma/client";
import { createStudentObservation } from "../src/lib/behavior-observation";

const prisma = new PrismaClient();
const MARKER = "[WALKTHROUGH]";
const MH_MARKER = "[MH-DEMO]";

async function findUser(email: string) {
  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    select: { id: true, name: true, email: true, studentId: true },
  });
  if (!user) {
    throw new Error(`ไม่พบ ${email} — รัน npx tsx scripts/seed-local-test-accounts.ts ก่อน`);
  }
  return user;
}

/** ผูกนิสิต → peer ให้เป็นที่ปรึกษาที่ใช้งาน (มีเมนูนิสิตในดูแล) */
async function ensurePeerAdvisor(studentId: string, peerAdvisorId: string) {
  const existing = await prisma.studentAdvisorAssignment.findFirst({
    where: { studentId, advisorId: peerAdvisorId },
  });
  if (existing) {
    if (!existing.isActive) {
      await prisma.studentAdvisorAssignment.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }
    return;
  }
  await prisma.studentAdvisorAssignment.create({
    data: { studentId, advisorId: peerAdvisorId, isActive: true },
  });
}

/** ล้างเคสของนิสิตทดสอบทั้งหมด — ส่งต่อ / ปรึกษา / แจ้ง / SOS / นัด MH */
async function cleanupWalkthrough(peerId: string, mhId: string, studentIds: string[]) {
  const referrals = await prisma.caseReferral.findMany({
    where: {
      OR: [
        { studentId: { in: studentIds } },
        { advisorId: peerId },
        { reason: { contains: MARKER } },
        { reason: { contains: MH_MARKER } },
      ],
    },
    select: { id: true },
  });
  const referralIds = referrals.map((row) => row.id);

  await prisma.mentalHealthAppointment.deleteMany({
    where: {
      OR: [
        { studentId: { in: studentIds } },
        { mentalHealthUserId: mhId },
        ...(referralIds.length > 0 ? [{ referralId: { in: referralIds } }] : []),
        { note: { contains: MARKER } },
        { note: { contains: MH_MARKER } },
      ],
    },
  });
  await prisma.specializedCareRecord.deleteMany({
    where: {
      OR: [
        { studentId: { in: studentIds } },
        { mentalHealthUserId: mhId },
        ...(referralIds.length > 0 ? [{ referralId: { in: referralIds } }] : []),
        { summary: { contains: MARKER } },
        { summary: { contains: MH_MARKER } },
      ],
    },
  });
  if (referralIds.length > 0) {
    await prisma.caseReferral.deleteMany({ where: { id: { in: referralIds } } });
  }

  const oldConsult = await prisma.consultationRequest.findMany({
    where: {
      OR: [
        { studentId: { in: studentIds } },
        { teacherId: peerId },
        { note: { contains: MARKER } },
      ],
    },
    select: { id: true, alertId: true },
  });
  if (oldConsult.length > 0) {
    const requestIds = oldConsult.map((row) => row.id);
    const alertIds = oldConsult.map((row) => row.alertId).filter((id): id is string => Boolean(id));
    await prisma.consultationScheduleOffer.deleteMany({ where: { requestId: { in: requestIds } } });
    await prisma.consultationRequest.deleteMany({ where: { id: { in: requestIds } } });
    if (alertIds.length > 0) {
      await prisma.alert.deleteMany({ where: { id: { in: alertIds } } });
    }
  }

  await prisma.careRecord.deleteMany({
    where: {
      OR: [{ studentId: { in: studentIds } }, { advisorId: peerId }],
    },
  });

  const oldBehaviors = await prisma.behaviorRecord.findMany({
    where: { studentId: { in: studentIds } },
    select: { id: true },
  });
  if (oldBehaviors.length > 0) {
    const ids = oldBehaviors.map((row) => row.id);
    await prisma.alert.deleteMany({
      where: { sourceType: "BehaviorRecord", sourceId: { in: ids } },
    });
    await prisma.behaviorRecord.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.emergencyCase.deleteMany({
    where: { studentId: { in: studentIds } },
  });

  await prisma.alert.deleteMany({
    where: {
      OR: [
        { studentId: { in: studentIds } },
        { recipientUserId: { in: [peerId, mhId] } },
      ],
    },
  });
}

async function main() {
  const student = await findUser("student.test@nucare.local");
  const peer = await findUser("advisor.peer@nucare.local");
  const mh = await findUser("mh.test@nucare.local");
  const s2 = await findUser("student2.test@nucare.local");
  const s3 = await findUser("student3.test@nucare.local");
  const students = [student, s2, s3];
  const studentIds = students.map((row) => row.id);

  console.log("ผูกนิสิตทดสอบ → advisor.peer (เมนูนิสิตในดูแล / สัญญาณ)");
  for (const row of students) {
    await ensurePeerAdvisor(row.id, peer.id);
  }

  await cleanupWalkthrough(peer.id, mh.id, studentIds);
  console.log("ล้างเคส walkthrough / MH demo / คำขอเปิดค้างแล้ว");

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  const daysAhead = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  // ——— ข้อสังเกตจากอาจารย์นอกสังกัด → สัญญาณเข้าของ peer (และที่ปรึกษาอื่นของนิสิต) ———
  // กฎ: ผู้แจ้งต้องไม่ใช่ที่ปรึกษาของนิสิตคนนั้น — ใช้ multi.all-staff
  const outsider = await findUser("multi.all-staff@nucare.local");
  const observationSpecs = [
    {
      student,
      category: "สุขภาพใจและความเครียด",
      details: `${MARKER} นอนไม่หลับ ซึมเศร้า มีความคิดท้อแท้ — ควรส่งต่อศูนย์ให้คำปรึกษา`,
      severity: BehaviorSeverity.HIGH,
      daysAgo: 1,
    },
    {
      student: s2,
      category: "การเรียนและผลการเรียน",
      details: `${MARKER} คะแนนตกลงชัด ดูเครียดเรื่องฝึกงาน`,
      severity: BehaviorSeverity.MEDIUM,
      daysAgo: 2,
    },
    {
      student: s3,
      category: "อื่น ๆ",
      details: `${MARKER} ปรับตัวชั้นปี 1 ยาก แยกตัวจากกลุ่ม`,
      severity: BehaviorSeverity.LOW,
      daysAgo: 3,
    },
  ] as const;

  for (const spec of observationSpecs) {
    const created = await createStudentObservation({
      reporterUserId: outsider.id,
      studentId: spec.student.id,
      category: spec.category,
      details: spec.details,
      severity: spec.severity,
      observedAt: daysAgo(spec.daysAgo),
    });
    console.log(
      `สัญญาณข้อสังเกต → ที่ปรึกษา ${created.notifiedAdvisorCount} คน · ${spec.student.name} · ผู้แจ้ง ${outsider.name}`
    );
  }

  // ——— คำขอปรึกษา → peer ———
  const pendingConsult = await prisma.consultationRequest.create({
    data: {
      studentId: student.id,
      teacherId: peer.id,
      topic: "สุขภาพใจและความเครียด",
      preferredChannel: ConsultationPreferredChannel.ONLINE,
      note: `${MARKER} อยากคุยเรื่องเครียดสอบและนอนไม่หลับ`,
      status: ConsultationRequestStatus.PENDING,
      createdAt: daysAgo(0),
    },
  });
  const pendingAlert = await prisma.alert.create({
    data: {
      recipientUserId: peer.id,
      actorUserId: student.id,
      studentId: student.id,
      type: AlertType.ADVISOR_FOLLOW_UP,
      priority: AlertPriority.MEDIUM,
      title: `${MARKER} นักศึกษาขอรับคำปรึกษา`,
      message: pendingConsult.note || pendingConsult.topic,
      status: AlertStatus.OPEN,
      sourceType: "ConsultationRequest",
      sourceId: pendingConsult.id,
    },
  });
  await prisma.consultationRequest.update({
    where: { id: pendingConsult.id },
    data: { alertId: pendingAlert.id },
  });

  const acceptedConsult = await prisma.consultationRequest.create({
    data: {
      studentId: s2.id,
      teacherId: peer.id,
      topic: "การเรียนและผลการเรียน",
      preferredChannel: ConsultationPreferredChannel.IN_PERSON,
      note: `${MARKER} นิสิตขอเปลี่ยนนัด — รออาจารย์ตอบ`,
      status: ConsultationRequestStatus.ACCEPTED,
      acceptedAt: daysAgo(2),
      createdAt: daysAgo(3),
    },
  });
  await prisma.consultationScheduleOffer.create({
    data: {
      requestId: acceptedConsult.id,
      proposedById: s2.id,
      proposedAt: daysAhead(4),
      location: "ห้องที่ปรึกษา A",
      note: `${MARKER} ขอเลื่อนเป็นช่วงบ่าย`,
      status: ConsultationOfferStatus.PENDING,
    },
  });

  await prisma.consultationRequest.create({
    data: {
      studentId: s3.id,
      teacherId: peer.id,
      topic: "ทุนการศึกษาและค่าใช้จ่าย",
      preferredChannel: ConsultationPreferredChannel.ONLINE,
      note: `${MARKER} นัดยืนยันแล้ว`,
      status: ConsultationRequestStatus.SCHEDULED,
      acceptedAt: daysAgo(5),
      scheduledAt: daysAhead(2),
      scheduleLocation: "ออนไลน์ (Zoom)",
      createdAt: daysAgo(6),
    },
  });

  await prisma.consultationRequest.create({
    data: {
      studentId: student.id,
      teacherId: peer.id,
      topic: "อื่น ๆ",
      preferredChannel: ConsultationPreferredChannel.IN_PERSON,
      note: `${MARKER} ประวัติปิดแล้ว`,
      status: ConsultationRequestStatus.CLOSED,
      acceptedAt: daysAgo(14),
      closedAt: daysAgo(10),
      advisorNote: `${MARKER} พูดคุยแล้ว ส่งต่อศูนย์ให้คำปรึกษาต่อ`,
      createdAt: daysAgo(16),
    },
  });

  await prisma.consultationRequest.create({
    data: {
      studentId: s2.id,
      teacherId: peer.id,
      topic: "ความสัมพันธ์และครอบครัว",
      preferredChannel: ConsultationPreferredChannel.ONLINE,
      note: `${MARKER} ประวัติที่ยกเลิกแล้ว`,
      status: ConsultationRequestStatus.CANCELLED,
      acceptedAt: daysAgo(12),
      closedAt: daysAgo(11),
      advisorNote: `ขอยกเลิก — ตารางเวลาไม่สะดวกในช่วงนี้ · อาจารย์รับทราบ: รับทราบแล้ว`,
      createdAt: daysAgo(13),
    },
  });

  console.log(
    `คำขอปรึกษา peer: PENDING(${student.name}) · ACCEPTED+ข้อเสนอ(${s2.name}) · SCHEDULED(${s3.name}) · CLOSED+CANCELLED ประวัติ`
  );

  // ——— สุขภาพจิต: ประวัติปิด + คิวปัจจุบัน (advisor = peer) ———
  for (const [index, row] of students.entries()) {
    const closedAt = daysAgo(20 - index * 3);
    const closedReferral = await prisma.caseReferral.create({
      data: {
        studentId: row.id,
        advisorId: peer.id,
        target: ReferralTarget.COUNSELING_CENTER,
        reason: `${MH_MARKER} ${MARKER} ประวัติรอบก่อน — ติดตามความเครียด (${row.name})`,
        isUrgent: false,
        status: ReferralStatus.CLOSED,
        createdAt: daysAgo(28 - index * 3),
        updatedAt: closedAt,
      },
    });
    await prisma.specializedCareRecord.create({
      data: {
        studentId: row.id,
        mentalHealthUserId: mh.id,
        referralId: closedReferral.id,
        sessionDate: daysAgo(22 - index * 3),
        summary: `${MH_MARKER}\nS: เล่าเรื่องเครียดสอบ\nO: สีหน้ากังวล\nA: ความเครียดปานกลาง`,
        interventionPlan: `${MH_MARKER}\nP: ฝึกหายใจ ติดตาม 2 สัปดาห์`,
        confidentialNotes: `${MH_MARKER} บันทึกลับรอบก่อนของ ${row.name}`,
        createdAt: daysAgo(22 - index * 3),
      },
    });
    await prisma.mentalHealthAppointment.create({
      data: {
        studentId: row.id,
        mentalHealthUserId: mh.id,
        referralId: closedReferral.id,
        scheduledAt: daysAgo(22 - index * 3),
        location: "ห้องให้คำปรึกษา 1",
        note: `${MH_MARKER} นัดรอบก่อน (พบแล้ว)`,
        status: MentalHealthAppointmentStatus.COMPLETED,
        createdAt: daysAgo(25 - index * 3),
      },
    });
    await prisma.studentAssessment.create({
      data: {
        studentId: row.id,
        instrument: AssessmentInstrument.Q9,
        totalScore: 8 + index * 3,
        riskLevel: index === 0 ? RiskLevel.HIGH : index === 1 ? RiskLevel.MEDIUM : RiskLevel.NORMAL,
        assessedAt: daysAgo(15 - index),
      },
    });
  }

  const pendingReferral = await prisma.caseReferral.create({
    data: {
      studentId: student.id,
      advisorId: peer.id,
      target: ReferralTarget.COUNSELING_CENTER,
      reason: `${MH_MARKER} ${MARKER} ส่งต่อเร่งด่วนจากที่ปรึกษา (peer) — นอนไม่หลับ ซึมเศร้า มีความคิดท้อแท้`,
      isUrgent: true,
      status: ReferralStatus.PENDING,
      createdAt: daysAgo(1),
    },
  });

  const acceptedWithAppt = await prisma.caseReferral.create({
    data: {
      studentId: s2.id,
      advisorId: peer.id,
      acceptedByUserId: mh.id,
      target: ReferralTarget.COUNSELING_CENTER,
      reason: `${MH_MARKER} ${MARKER} ส่งต่อติดตามหลังคัดกรอง — มีนัดและบันทึกผลแล้ว`,
      isUrgent: false,
      status: ReferralStatus.ACCEPTED,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(4),
    },
  });

  const acceptedNeedAppt = await prisma.caseReferral.create({
    data: {
      studentId: s3.id,
      advisorId: peer.id,
      acceptedByUserId: mh.id,
      target: ReferralTarget.COUNSELING_CENTER,
      reason: `${MH_MARKER} ${MARKER} ส่งต่อปรับตัวชั้นปี 1 — รับแล้วรอสร้างนัด`,
      isUrgent: false,
      status: ReferralStatus.ACCEPTED,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
  });

  await prisma.mentalHealthAppointment.create({
    data: {
      studentId: s2.id,
      mentalHealthUserId: mh.id,
      referralId: acceptedWithAppt.id,
      scheduledAt: daysAhead(2),
      location: "ห้องให้คำปรึกษา 2",
      note: `${MH_MARKER} นัดติดตามอาการ`,
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
      note: `${MH_MARKER} นัดรอบแรก (พบแล้ว)`,
      status: MentalHealthAppointmentStatus.COMPLETED,
    },
  });
  await prisma.specializedCareRecord.create({
    data: {
      studentId: s2.id,
      mentalHealthUserId: mh.id,
      referralId: acceptedWithAppt.id,
      sessionDate: daysAgo(2),
      summary: `${MH_MARKER}\nS: กังวลเรื่องฝึกงาน\nO: พูดช้า\nA: ความเครียดปานกลาง`,
      interventionPlan: `${MH_MARKER}\nP: นัดติดตาม 1 สัปดาห์`,
      confidentialNotes: `${MH_MARKER} บันทึกลับ — ประวัติอ่อนไหว`,
    },
  });
  await prisma.specializedCareRecord.create({
    data: {
      studentId: s3.id,
      mentalHealthUserId: mh.id,
      referralId: acceptedNeedAppt.id,
      sessionDate: daysAgo(1),
      summary: `${MH_MARKER}\nS: ปรับตัวชั้นปี 1 ยาก\nO: สุภาพ ร่วมมือดี\nA: ปัญหาปรับตัว`,
      interventionPlan: `${MH_MARKER}\nP: สร้างนัดพบตัวสัปดาห์หน้า`,
      confidentialNotes: null,
    },
  });

  await prisma.alert.create({
    data: {
      recipientUserId: mh.id,
      actorUserId: peer.id,
      studentId: student.id,
      type: AlertType.REFERRAL_RECEIVED,
      priority: AlertPriority.HIGH,
      title: `${MARKER} มีเคสส่งต่อเร่งด่วน`,
      message: pendingReferral.reason,
      status: AlertStatus.OPEN,
      sourceType: "CaseReferral",
      sourceId: pendingReferral.id,
    },
  });

  const sos = await prisma.emergencyCase.create({
    data: {
      studentId: student.id,
      reportedByUserId: student.id,
      summary: `${MARKER} นิสิตร้องขอความช่วยเหลือด่วนผ่านหน้าที่ปรึกษา (ทดสอบ flow)`,
      status: EmergencyCaseStatus.OPEN,
      openedAt: daysAgo(0),
    },
  });
  await prisma.alert.create({
    data: {
      recipientUserId: mh.id,
      actorUserId: student.id,
      studentId: student.id,
      type: AlertType.SOS_OPENED,
      priority: AlertPriority.CRITICAL,
      title: `${MARKER} SOS จากนิสิต`,
      message: "มีคำขอช่วยเหลือด่วนจากนิสิตทดสอบ",
      status: AlertStatus.OPEN,
      sourceType: "EmergencyCase",
      sourceId: sos.id,
    },
  });
  await prisma.alert.create({
    data: {
      recipientUserId: peer.id,
      actorUserId: student.id,
      studentId: student.id,
      type: AlertType.SOS_OPENED,
      priority: AlertPriority.CRITICAL,
      title: `${MARKER} SOS จากนิสิตในดูแล`,
      message: "มีคำขอช่วยเหลือด่วนจากนิสิตทดสอบ",
      status: AlertStatus.OPEN,
      sourceType: "EmergencyCase",
      sourceId: sos.id,
    },
  });

  const { getMentalHealthStudentHistoryByReferral } = await import(
    "../src/lib/mental-health-student-history"
  );
  for (const referral of [pendingReferral, acceptedWithAppt, acceptedNeedAppt]) {
    const history = await getMentalHealthStudentHistoryByReferral(prisma, mh.id, referral.id);
    if (history === "forbidden" || history === "not_found") {
      throw new Error(`โหลดประวัติ referral ${referral.id} ไม่สำเร็จ: ${history}`);
    }
    console.log(
      `ประวัติ OK · ${history.student.name} · กิจกรรม ${history.activity.length} รายการ`
    );
  }

  console.log("\n========== Walkthrough พร้อมแล้ว ==========");
  console.log("รหัสผ่านทุกบัญชี: NucareTest!2026");
  console.log("");
  console.log("1) student.test@nucare.local");
  console.log("   - หน้าที่ปรึกษา: คำขอ PENDING ไป peer · ประวัติปิดแล้ว");
  console.log("   - SOS เปิดอยู่ (แจ้ง peer + MH)");
  console.log("");
  console.log("2) advisor.peer@nucare.local");
  console.log("   - นิสิตในดูแล: ภูมิพัฒน์ / กมลวรรณ / ธนกฤต");
  console.log("   - คำขอปรึกษา: รอรับ · รับแล้ว+ข้อเสนอ · นัดแล้ว");
  console.log("   - สัญญาณเข้า: ข้อสังเกตจากอาจารย์นอกสังกัด 3 รายการ · SOS ในดูแล");
  console.log("   - ข้อสังเกตที่แจ้ง: ใช้แจ้งนิสิตของอาจารย์ท่านอื่น (ไม่รวมในสังกัดตัวเอง)");
  console.log("   - ส่งต่อ MH แล้ว (คิวเร่งด่วนของภูมิพัฒน์)");
  console.log("");
  console.log("3) mh.test@nucare.local");
  console.log("   - คิวรอรับ (เร่งด่วน): ภูมิพัฒน์");
  console.log("   - เคสที่ดูแล: กมลวรรณ (มีนัด+บันทึก) · ธนกฤต (รอสร้างนัด)");
  console.log("   - SOS บนหน้าหลัก · ประวัติ/กิจกรรมล่าสุดครบ");
  console.log("==========================================");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
