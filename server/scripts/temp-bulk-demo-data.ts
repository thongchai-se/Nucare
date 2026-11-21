/**
 * ข้อมูลทดสอบชั่วคราว — นิสิตจำนวนมาก + เคสครบทุกสถานะ/ทุกบทบาท
 * ไม่ใช่ seed ถาวร · ลบได้ด้วย --cleanup
 *
 * รัน:
 *   npx tsx scripts/seed-local-test-accounts.ts
 *   npx tsx scripts/temp-bulk-demo-data.ts
 *   npx tsx scripts/temp-bulk-demo-data.ts --cleanup
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
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
  Role,
  SurveyWaveStatus,
  WellnessTrendSignalCode,
} from "@prisma/client";

const prisma = new PrismaClient();

const MOCK_PASSWORD = "NucareTest!2026";
const BULK_TAG = "TEMP_BULK_DEMO";
const STUDENT_COUNT = 48;
const STUDENT_ID_PREFIX = "6822";
const EMAIL_SUFFIX = "@nucare.local";

const EXAMPLE_STUDENT_EMAILS = [
  "student1.example@nucare.local",
  "student2.example@nucare.local",
  "student3.example@nucare.local",
  "student4.example@nucare.local",
  "student5.example@nucare.local",
  "student6.example@nucare.local",
  "student7.example@nucare.local",
  "student8.example@nucare.local",
] as const;

const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const daysFromNow = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const pad = (value: number, width = 5): string => String(value).padStart(width, "0");

/** รหัสนิสิตชั่วคราวรูปแบบ 6822xxxxx-d */
const buildStudentId = (index: number): string => {
  const body = `${STUDENT_ID_PREFIX}${pad(index, 5)}`;
  const check = String((index % 9) + 1);
  return `${body.slice(0, 9)}-${check}`;
};

const buildEmail = (index: number): string => `bulk.student${pad(index, 3)}${EMAIL_SUFFIX}`;

const thaiSections = ["A", "B", "C", "D"] as const;

type StaffBundle = {
  advisors: Array<{ id: string; name: string; email: string | null }>;
  sdUsers: Array<{ id: string; name: string }>;
  mhUsers: Array<{ id: string; name: string }>;
  executive: { id: string; name: string } | null;
  admin: { id: string; name: string } | null;
};

const requireStaff = async (): Promise<StaffBundle> => {
  const [advisor1, advisor2, multiAdvisor, sd1, sd2, mh1, mh2, executive, admin] =
    await Promise.all([
      prisma.user.findFirst({ where: { email: "advisor1.example@nucare.local", isActive: true } }),
      prisma.user.findFirst({ where: { email: "advisor2.example@nucare.local", isActive: true } }),
      prisma.user.findFirst({
        where: { email: "multi.sd-advisor.example@nucare.local", isActive: true },
      }),
      prisma.user.findFirst({ where: { email: "sd1.example@nucare.local", isActive: true } }),
      prisma.user.findFirst({ where: { email: "sd2.example@nucare.local", isActive: true } }),
      prisma.user.findFirst({ where: { email: "mh1.example@nucare.local", isActive: true } }),
      prisma.user.findFirst({ where: { email: "mh2.example@nucare.local", isActive: true } }),
      prisma.user.findFirst({
        where: { email: "executive1.example@nucare.local", isActive: true },
      }),
      prisma.user.findFirst({ where: { email: "adminnucare@gmail.com", isActive: true } }),
    ]);

  if (!advisor1 || !advisor2 || !sd1 || !mh1) {
    throw new Error(
      "ไม่พบบัญชี staff ตัวอย่าง — รัน seed-local-test-accounts.ts ก่อน แล้วค่อยรันสคริปต์นี้"
    );
  }

  return {
    advisors: [advisor1, advisor2, multiAdvisor].filter(Boolean) as StaffBundle["advisors"],
    sdUsers: [sd1, sd2].filter(Boolean) as StaffBundle["sdUsers"],
    mhUsers: [mh1, mh2].filter(Boolean) as StaffBundle["mhUsers"],
    executive: executive ? { id: executive.id, name: executive.name } : null,
    admin: admin ? { id: admin.id, name: admin.name } : null,
  };
};

/** ลบเคสที่ติดแท็ก demo บนบัญชีตัวอย่าง (ไม่ลบบัญชี) */
async function cleanupTaggedCases() {
  const tag = { contains: BULK_TAG };

  await prisma.alert.deleteMany({ where: { OR: [{ title: tag }, { message: tag }] } });
  await prisma.consultationScheduleOffer.deleteMany({
    where: { OR: [{ note: tag }, { location: tag }] },
  });
  await prisma.mentalHealthScheduleOffer.deleteMany({
    where: { OR: [{ note: tag }, { location: tag }] },
  });
  await prisma.consultationRequest.deleteMany({ where: { topic: tag } });
  await prisma.caseReferralDecline.deleteMany({
    where: { referral: { reason: tag } },
  });
  await prisma.mentalHealthAppointment.deleteMany({ where: { note: tag } });
  await prisma.specializedCareRecord.deleteMany({ where: { summary: tag } });
  await prisma.caseReferral.deleteMany({ where: { reason: tag } });
  await prisma.emergencyCase.deleteMany({ where: { summary: tag } });
  await prisma.behaviorRecord.deleteMany({ where: { details: tag } });
  await prisma.careRecord.deleteMany({ where: { topic: tag } });
  await prisma.studentAssessment.deleteMany({
    where: { student: { email: { startsWith: "bulk.student" } } },
  });
  await prisma.auditLog.deleteMany({ where: { description: tag } });
  await prisma.studentWellnessTrendHit.deleteMany({
    where: { source: { startsWith: BULK_TAG } },
  });
  await prisma.studentWellnessTrendSummary.deleteMany({
    where: { student: { email: { startsWith: "bulk.student" } } },
  });
}

/** ลบนิสิต bulk + ข้อมูลที่ cascade ตามมา */
async function cleanup() {
  await cleanupTaggedCases();

  const students = await prisma.user.findMany({
    where: {
      role: Role.STUDENT,
      OR: [
        { email: { startsWith: "bulk.student" } },
        { name: { startsWith: "นิสิตทดสอบจำนวนมาก" } },
        { studentId: { startsWith: STUDENT_ID_PREFIX } },
      ],
    },
    select: { id: true },
  });

  if (students.length === 0) {
    console.log("cleanup: ลบเคสแท็กแล้ว — ไม่มีนิสิต bulk ให้ลบ");
    return;
  }

  const ids = students.map((student) => student.id);
  await prisma.alert.deleteMany({
    where: {
      OR: [{ studentId: { in: ids } }, { title: { contains: BULK_TAG } }],
    },
  });

  const deleted = await prisma.user.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`cleanup: ลบนิสิต bulk ${deleted.count} คน + เคสแท็ก demo`);
}

/** ใส่ audit ครบสถานะแสดงผล (สำเร็จ / บางส่วน / ไม่สำเร็จ / เฝ้าระวัง / สูง / วิกฤต) */
async function seedAuditGallery(staff: StaffBundle) {
  const actorId = staff.admin?.id ?? staff.sdUsers[0]?.id ?? null;
  const samples: Array<{ action: string; description: string; entityType: string }> = [
    {
      action: "users.import",
      description: `[${BULK_TAG}] outcome=success created=12 updated=3 skipped=1 failed=0`,
      entityType: "User",
    },
    {
      action: "users.import",
      description: `[${BULK_TAG}] outcome=partial created=5 updated=2 skipped=0 failed=4`,
      entityType: "User",
    },
    {
      action: "users.import",
      description: `[${BULK_TAG}] outcome=failed created=0 updated=0 skipped=0 failed=9`,
      entityType: "User",
    },
    {
      action: "auth.login.failed",
      description: `[${BULK_TAG}] email=unknown@example.com reason=invalid_password`,
      entityType: "Auth",
    },
    {
      action: "security.rate-limit",
      description: `[${BULK_TAG}] path=/api/auth/login ip=203.0.113.10`,
      entityType: "Security",
    },
    {
      action: "security.authz-denied",
      description: `[${BULK_TAG}] path=/api/admin/users role=STUDENT`,
      entityType: "Security",
    },
    {
      action: "security.privilege-probe",
      description: `[${BULK_TAG}] path=/api/admin/system-health`,
      entityType: "Security",
    },
    {
      action: "auth.refresh.reuse-detected",
      description: `[${BULK_TAG}] tokenFamily=demo-family-1`,
      entityType: "Security",
    },
    {
      action: "referral.accept",
      description: `[${BULK_TAG}] รับเคสส่งต่องานพัฒนานิสิต`,
      entityType: "CaseReferral",
    },
    {
      action: "screening-review.acknowledge",
      description: `[${BULK_TAG}] รับทราบผลคัดกรองในคิวทบทวน`,
      entityType: "SurveyResponse",
    },
  ];

  for (const [index, sample] of samples.entries()) {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorId,
        action: sample.action,
        entityType: sample.entityType,
        entityId: `bulk-audit-${index + 1}`,
        description: sample.description,
        ipAddress: `203.0.113.${10 + index}`,
        createdAt: daysAgo(index),
      },
    });
  }

  return samples.length;
}

/** ใส่ผลแบบประเมิน MEDIUM/HIGH เพื่อให้คิวทบทวนมีรายการ */
async function seedSurveyResponses(studentIds: string[]) {
  const survey = await prisma.survey.findFirst({
    where: { status: "PUBLISHED" },
    include: {
      waves: { where: { status: SurveyWaveStatus.OPEN }, take: 1, orderBy: { createdAt: "desc" } },
      versions: { where: { status: "PUBLISHED" }, take: 1 },
    },
  });

  const wave = survey?.waves[0];
  const versionId = survey?.versions[0]?.id ?? null;
  if (!survey || !wave) {
    console.log("surveyResponses: ข้าม — ไม่พบแบบประเมิน PUBLISHED ที่มีคลื่น OPEN");
    return 0;
  }

  let count = 0;
  const riskCycle = [RiskLevel.NORMAL, RiskLevel.MEDIUM, RiskLevel.HIGH] as const;

  for (let index = 0; index < Math.min(studentIds.length, 24); index += 1) {
    const studentId = studentIds[index];
    const riskLevel = riskCycle[index % 3];
    const totalScore =
      riskLevel === RiskLevel.HIGH ? 22 + (index % 4) : riskLevel === RiskLevel.MEDIUM ? 12 + (index % 4) : 3 + (index % 3);

    await prisma.surveyResponse.upsert({
      where: { waveId_studentId: { waveId: wave.id, studentId } },
      create: {
        surveyId: survey.id,
        waveId: wave.id,
        studentId,
        versionId,
        totalScore,
        maxScore: 28,
        scorePercent: Math.round((totalScore / 28) * 100),
        riskLevel,
        instrument: survey.instrumentCode ?? "CUSTOM",
        scoredAt: daysAgo(1 + (index % 5)),
        submittedAt: daysAgo(1 + (index % 5)),
      },
      update: {
        totalScore,
        maxScore: 28,
        scorePercent: Math.round((totalScore / 28) * 100),
        riskLevel,
        instrument: survey.instrumentCode ?? "CUSTOM",
        scoredAt: daysAgo(1 + (index % 5)),
        submittedAt: daysAgo(1 + (index % 5)),
        versionId,
      },
    });
    count += 1;
  }

  return count;
}

/**
 * Showcase บนบัญชีตัวอย่าง 1–8 — แต่ละคนเป็นเคสสถานะต่างกันชัดเจน
 * เพื่อล็อกอินดู UI ได้ทันทีโดยไม่ต้องหา bulk
 */
async function seedShowcase(staff: StaffBundle) {
  const students = await prisma.user.findMany({
    where: { email: { in: [...EXAMPLE_STUDENT_EMAILS] }, isActive: true },
    orderBy: { email: "asc" },
  });
  if (students.length < 8) {
    throw new Error("ไม่ครบบัญชีนิสิตตัวอย่าง 1–8 — รัน seed-local-test-accounts.ts ก่อน");
  }

  // รีเซ็ตผลประเมิน/แนวโน้มของบัญชีตัวอย่างก่อนใส่ชุด showcase ใหม่
  const exampleIds = students.map((row) => row.id);
  await prisma.studentAssessment.deleteMany({ where: { studentId: { in: exampleIds } } });
  await prisma.studentWellnessTrendHit.deleteMany({
    where: { studentId: { in: exampleIds }, source: { startsWith: BULK_TAG } },
  });
  await prisma.studentWellnessTrendSummary.deleteMany({
    where: { studentId: { in: exampleIds } },
  });

  const byEmail = new Map(students.map((s) => [s.email, s]));
  const s = (n: number) => {
    const user = byEmail.get(`student${n}.example@nucare.local`);
    if (!user) throw new Error(`missing student${n}`);
    return user;
  };

  const advisor1 = staff.advisors[0];
  const advisor2 = staff.advisors[1] ?? advisor1;
  const sd1 = staff.sdUsers[0];
  const sd2 = staff.sdUsers[1] ?? sd1;
  const mh1 = staff.mhUsers[0];
  const mh2 = staff.mhUsers[1] ?? mh1;

  const summary = {
    consultations: 0,
    referrals: 0,
    emergencies: 0,
    appointments: 0,
    offers: 0,
    declines: 0,
    assessments: 0,
    behaviors: 0,
    care: 0,
    alerts: 0,
    wellness: 0,
  };

  // student1 — คำขอปรึกษารอตอบ + ข้อเสนอนัดจากอาจารย์
  {
    const student = s(1);
    await prisma.studentAssessment.create({
      data: {
        studentId: student.id,
        instrument: AssessmentInstrument.Q9,
        totalScore: 4,
        riskLevel: RiskLevel.NORMAL,
        assessedAt: daysAgo(2),
      },
    });
    summary.assessments += 1;

    const req = await prisma.consultationRequest.create({
      data: {
        studentId: student.id,
        teacherId: advisor1.id,
        topic: `[${BULK_TAG}] ขอปรึกษาเรื่องปรับตัวชั้นปี 1`,
        preferredChannel: ConsultationPreferredChannel.IN_PERSON,
        note: "อยากคุยเรื่องการเรียนและเพื่อน",
        status: ConsultationRequestStatus.ACCEPTED,
        advisorNote: "รับเรื่องแล้ว เสนอเวลานัด",
        acceptedAt: daysAgo(1),
      },
    });
    summary.consultations += 1;

    await prisma.consultationScheduleOffer.create({
      data: {
        requestId: req.id,
        proposedById: advisor1.id,
        proposedAt: daysFromNow(2),
        location: `[${BULK_TAG}] ห้องที่ปรึกษา ชั้น 3`,
        note: `[${BULK_TAG}] ข้อเสนอให้นิสิตตอบรับ`,
        status: ConsultationOfferStatus.PENDING,
      },
    });
    summary.offers += 1;

    await prisma.alert.create({
      data: {
        recipientUserId: student.id,
        actorUserId: advisor1.id,
        studentId: student.id,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.MEDIUM,
        title: `[${BULK_TAG}] มีข้อเสนอนัดหมายใหม่`,
        message: "อาจารย์เสนอเวลานัดปรึกษา กรุณาตอบรับหรือเสนอเวลาใหม่",
        status: AlertStatus.OPEN,
        sourceType: "ConsultationRequest",
        sourceId: req.id,
      },
    });
    summary.alerts += 1;
  }

  // student2 — นัดปรึกษา SCHEDULED
  {
    const student = s(2);
    await prisma.consultationRequest.create({
      data: {
        studentId: student.id,
        teacherId: advisor1.id,
        topic: `[${BULK_TAG}] นัดปรึกษาเรื่องแผนการเรียน`,
        preferredChannel: ConsultationPreferredChannel.ONLINE,
        status: ConsultationRequestStatus.SCHEDULED,
        advisorNote: "นัดออนไลน์แล้ว",
        scheduledAt: daysFromNow(3),
        scheduleLocation: "Google Meet",
        acceptedAt: daysAgo(2),
      },
    });
    summary.consultations += 1;

    await prisma.careRecord.create({
      data: {
        studentId: student.id,
        advisorId: advisor1.id,
        careDate: daysAgo(5),
        careType: "ติดตามผล",
        topic: `[${BULK_TAG}] ติดตามแผนเรียน`,
        action: "พูดคุยและวางแผนรายวิชา",
        outcome: "นิสิตเข้าใจแนวทางแล้ว",
      },
    });
    summary.care += 1;
  }

  // student3 — CANCEL_REQUESTED + CANCELLED อีกเคส
  {
    const student = s(3);
    await prisma.consultationRequest.create({
      data: {
        studentId: student.id,
        teacherId: advisor1.id,
        topic: `[${BULK_TAG}] ขอเลื่อน/ยกเลิกนัดปรึกษา`,
        preferredChannel: ConsultationPreferredChannel.PHONE,
        status: ConsultationRequestStatus.CANCEL_REQUESTED,
        advisorNote: "นิสิตขอเลื่อน",
        scheduledAt: daysFromNow(1),
        scheduleLocation: "ห้องที่ปรึกษา",
        acceptedAt: daysAgo(3),
      },
    });
    await prisma.consultationRequest.create({
      data: {
        studentId: student.id,
        teacherId: advisor2.id,
        topic: `[${BULK_TAG}] คำขอปรึกษาที่ยกเลิกแล้ว`,
        preferredChannel: ConsultationPreferredChannel.MESSAGE,
        status: ConsultationRequestStatus.CANCELLED,
        advisorNote: "ยกเลิกตามคำขอ",
        acceptedAt: daysAgo(10),
        closedAt: daysAgo(8),
      },
    });
    summary.consultations += 2;
  }

  // student4 — CLOSED consultation + behavior + PENDING consultation
  {
    const student = s(4);
    await prisma.consultationRequest.create({
      data: {
        studentId: student.id,
        teacherId: advisor1.id,
        topic: `[${BULK_TAG}] ปิดเคสปรึกษาเรียบร้อย`,
        preferredChannel: ConsultationPreferredChannel.IN_PERSON,
        status: ConsultationRequestStatus.CLOSED,
        advisorNote: "พูดคุยครบแล้ว",
        scheduledAt: daysAgo(2),
        scheduleLocation: "ห้องที่ปรึกษา",
        acceptedAt: daysAgo(5),
        closedAt: daysAgo(1),
      },
    });
    await prisma.consultationRequest.create({
      data: {
        studentId: student.id,
        teacherId: advisor1.id,
        topic: `[${BULK_TAG}] คำขอปรึกษาใหม่รออาจารย์ตอบ`,
        preferredChannel: ConsultationPreferredChannel.ONLINE,
        status: ConsultationRequestStatus.PENDING,
        note: "มีเรื่องด่วนอยากคุย",
      },
    });
    summary.consultations += 2;

    await prisma.behaviorRecord.create({
      data: {
        studentId: student.id,
        instructorId: advisor1.id,
        observedAt: daysAgo(1),
        category: "การมีส่วนร่วม",
        details: `[${BULK_TAG}] ขาดส่งงานบ่อยใน 2 สัปดาห์`,
        severity: BehaviorSeverity.MEDIUM,
      },
    });
    summary.behaviors += 1;

    await prisma.alert.create({
      data: {
        recipientUserId: advisor1.id,
        actorUserId: advisor1.id,
        studentId: student.id,
        type: AlertType.BEHAVIOR_REPORTED,
        priority: AlertPriority.MEDIUM,
        title: `[${BULK_TAG}] บันทึกพฤติกรรมใหม่`,
        message: "มีบันทึกพฤติกรรมระดับปานกลาง",
        status: AlertStatus.OPEN,
      },
    });
    summary.alerts += 1;
  }

  // student5 — ส่งต่อ SD: PENDING / ACCEPTED / CLOSED ครบ
  {
    const student = s(5);
    await prisma.studentAssessment.create({
      data: {
        studentId: student.id,
        instrument: AssessmentInstrument.ST5,
        totalScore: 12,
        riskLevel: RiskLevel.MEDIUM,
        assessedAt: daysAgo(1),
      },
    });
    summary.assessments += 1;

    await prisma.caseReferral.create({
      data: {
        studentId: student.id,
        advisorId: advisor2.id,
        target: ReferralTarget.STUDENT_DEVELOPMENT,
        reason: `[${BULK_TAG}] ส่งต่อสวัสดิการ — ต้องการทุนและที่พัก`,
        isUrgent: false,
        status: ReferralStatus.PENDING,
      },
    });
    await prisma.caseReferral.create({
      data: {
        studentId: student.id,
        advisorId: advisor2.id,
        acceptedByUserId: sd1.id,
        target: ReferralTarget.STUDENT_DEVELOPMENT,
        reason: `[${BULK_TAG}] ส่งต่อ SD — กำลังช่วยเหลือเรื่องทุน`,
        isUrgent: true,
        status: ReferralStatus.ACCEPTED,
        staffNote: "รับเรื่องแล้ว ติดต่อกองทุน",
      },
    });
    await prisma.caseReferral.create({
      data: {
        studentId: student.id,
        advisorId: advisor2.id,
        acceptedByUserId: sd2.id,
        target: ReferralTarget.STUDENT_DEVELOPMENT,
        reason: `[${BULK_TAG}] ส่งต่อ SD — ปิดเคสหลังช่วยเหลือแล้ว`,
        status: ReferralStatus.CLOSED,
        staffNote: "ช่วยเหลือครบ",
        closedReason: "นิสิตได้รับทุนเรียบร้อย",
      },
    });
    summary.referrals += 3;

    await prisma.alert.create({
      data: {
        recipientUserId: sd1.id,
        actorUserId: advisor2.id,
        studentId: student.id,
        type: AlertType.REFERRAL_RECEIVED,
        priority: AlertPriority.HIGH,
        title: `[${BULK_TAG}] เคสส่งต่องานพัฒนานิสิตใหม่`,
        message: "มีเคสรอรับที่งานพัฒนานิสิต",
        status: AlertStatus.OPEN,
      },
    });
    summary.alerts += 1;
  }

  // student6 — MH: ACCEPTED + นัด + ข้อเสนอ + specialized care + decline อีกเคส
  {
    const student = s(6);
    await prisma.studentAssessment.create({
      data: {
        studentId: student.id,
        instrument: AssessmentInstrument.Q9,
        totalScore: 19,
        riskLevel: RiskLevel.HIGH,
        assessedAt: daysAgo(1),
      },
    });
    summary.assessments += 1;

    const mhAccepted = await prisma.caseReferral.create({
      data: {
        studentId: student.id,
        advisorId: advisor2.id,
        acceptedByUserId: mh1.id,
        target: ReferralTarget.COUNSELING_CENTER,
        reason: `[${BULK_TAG}] ส่งต่อสุขภาพจิต — ความเครียดสูง ต้องการพูดคุย`,
        isUrgent: true,
        status: ReferralStatus.ACCEPTED,
        staffNote: "รับเคสและวางแผนดูแล",
      },
    });
    summary.referrals += 1;

    await prisma.specializedCareRecord.create({
      data: {
        studentId: student.id,
        mentalHealthUserId: mh1.id,
        referralId: mhAccepted.id,
        sessionDate: daysAgo(1),
        summary: `[${BULK_TAG}] สรุปเซสชันแรก — นิสิตรู้สึกเครียดเรื่องเรียน`,
        interventionPlan: "ฝึกหายใจ + นัดติดตามสัปดาห์หน้า",
        confidentialNotes: "บันทึกภายในทีม",
      },
    });

    await prisma.mentalHealthAppointment.create({
      data: {
        studentId: student.id,
        mentalHealthUserId: mh1.id,
        referralId: mhAccepted.id,
        scheduledAt: daysFromNow(4),
        location: "ห้องให้คำปรึกษา ชั้น 2",
        note: `[${BULK_TAG}] นัดติดตามครั้งที่ 2`,
        status: MentalHealthAppointmentStatus.SCHEDULED,
      },
    });
    await prisma.mentalHealthAppointment.create({
      data: {
        studentId: student.id,
        mentalHealthUserId: mh1.id,
        referralId: mhAccepted.id,
        scheduledAt: daysAgo(7),
        location: "ออนไลน์",
        note: `[${BULK_TAG}] นัดที่เสร็จแล้ว`,
        status: MentalHealthAppointmentStatus.COMPLETED,
      },
    });
    await prisma.mentalHealthAppointment.create({
      data: {
        studentId: student.id,
        mentalHealthUserId: mh2.id,
        referralId: mhAccepted.id,
        scheduledAt: daysAgo(3),
        location: "ห้องให้คำปรึกษา",
        note: `[${BULK_TAG}] นัดไม่มา`,
        status: MentalHealthAppointmentStatus.NO_SHOW,
      },
    });
    await prisma.mentalHealthAppointment.create({
      data: {
        studentId: student.id,
        mentalHealthUserId: mh1.id,
        referralId: mhAccepted.id,
        scheduledAt: daysAgo(14),
        location: "ห้องให้คำปรึกษา",
        note: `[${BULK_TAG}] นัดที่ยกเลิก`,
        status: MentalHealthAppointmentStatus.CANCELLED,
        cancelledAt: daysAgo(15),
      },
    });
    summary.appointments += 4;

    await prisma.mentalHealthScheduleOffer.create({
      data: {
        referralId: mhAccepted.id,
        proposedById: mh1.id,
        proposedAt: daysFromNow(6),
        location: `[${BULK_TAG}] ห้องให้คำปรึกษา ชั้น 2`,
        note: `[${BULK_TAG}] ข้อเสนอนัด MH ให้นิสิตตอบ`,
        status: ConsultationOfferStatus.PENDING,
      },
    });
    summary.offers += 1;

    const mhPending = await prisma.caseReferral.create({
      data: {
        studentId: student.id,
        advisorId: advisor1.id,
        target: ReferralTarget.COUNSELING_CENTER,
        reason: `[${BULK_TAG}] ส่งต่อ MH — คิวที่ถูกปฏิเสธโดยผู้เชี่ยวชาญคนหนึ่ง`,
        isUrgent: false,
        status: ReferralStatus.PENDING,
      },
    });
    await prisma.caseReferralDecline.create({
      data: { referralId: mhPending.id, userId: mh2.id },
    });
    summary.referrals += 1;
    summary.declines += 1;

    await prisma.alert.create({
      data: {
        recipientUserId: mh1.id,
        actorUserId: advisor2.id,
        studentId: student.id,
        type: AlertType.REFERRAL_RECEIVED,
        priority: AlertPriority.HIGH,
        title: `[${BULK_TAG}] เคสสุขภาพจิตเร่งด่วน`,
        message: "มีเคสรอดูแลในทีมสุขภาพจิต",
        status: AlertStatus.OPEN,
      },
    });
    await prisma.alert.create({
      data: {
        recipientUserId: advisor2.id,
        actorUserId: student.id,
        studentId: student.id,
        type: AlertType.HIGH_RISK_SCREENING,
        priority: AlertPriority.HIGH,
        title: `[${BULK_TAG}] ผลคัดกรองความเสี่ยงสูง`,
        message: "นิสิตตัวอย่าง6 ได้คะแนนในเกณฑ์เสี่ยงสูง",
        status: AlertStatus.OPEN,
      },
    });
    summary.alerts += 2;

    const signals = [
      WellnessTrendSignalCode.ACADEMIC_STRESS,
      WellnessTrendSignalCode.ANXIETY_THEME,
      WellnessTrendSignalCode.SLEEP_DISTURBANCE,
    ] as const;
    for (const signalCode of signals) {
      await prisma.studentWellnessTrendSummary.upsert({
        where: { studentId_signalCode: { studentId: student.id, signalCode } },
        create: {
          studentId: student.id,
          signalCode,
          occurrenceCount: 3,
          firstDetectedAt: daysAgo(14),
          lastDetectedAt: daysAgo(1),
        },
        update: {
          occurrenceCount: 3,
          lastDetectedAt: daysAgo(1),
        },
      });
      await prisma.studentWellnessTrendHit.create({
        data: {
          studentId: student.id,
          signalCode,
          source: `${BULK_TAG}:chat`,
          detectedAt: daysAgo(1),
        },
      });
      summary.wellness += 1;
    }
  }

  // student7 — SOS ทุกสถานะ + แจ้งเตือน CRITICAL
  {
    const student = s(7);
    await prisma.emergencyCase.create({
      data: {
        studentId: student.id,
        reportedByUserId: student.id,
        summary: `[${BULK_TAG}] SOS เปิดอยู่ — ต้องการความช่วยเหลือด่วน`,
        status: EmergencyCaseStatus.OPEN,
        openedAt: daysAgo(0),
      },
    });
    await prisma.emergencyCase.create({
      data: {
        studentId: student.id,
        reportedByUserId: student.id,
        summary: `[${BULK_TAG}] SOS กำลังดำเนินการ`,
        status: EmergencyCaseStatus.IN_PROGRESS,
        openedAt: daysAgo(2),
      },
    });
    await prisma.emergencyCase.create({
      data: {
        studentId: student.id,
        reportedByUserId: sd1.id,
        summary: `[${BULK_TAG}] SOS ปิดแล้วหลังประสานช่วยเหลือ`,
        status: EmergencyCaseStatus.RESOLVED,
        openedAt: daysAgo(10),
        resolvedAt: daysAgo(9),
      },
    });
    summary.emergencies += 3;

    for (const recipient of [...staff.sdUsers, ...staff.mhUsers, advisor2]) {
      await prisma.alert.create({
        data: {
          recipientUserId: recipient.id,
          actorUserId: student.id,
          studentId: student.id,
          type: AlertType.SOS_OPENED,
          priority: AlertPriority.CRITICAL,
          title: `[${BULK_TAG}] SOS เปิดเคส`,
          message: "นิสิตตัวอย่าง7 กด SOS",
          status: AlertStatus.OPEN,
        },
      });
      summary.alerts += 1;
    }
  }

  // student8 — CLOSED MH + เตือนทำแบบประเมิน + HIGH assessment
  {
    const student = s(8);
    await prisma.studentAssessment.create({
      data: {
        studentId: student.id,
        instrument: AssessmentInstrument.Q2,
        totalScore: 21,
        riskLevel: RiskLevel.HIGH,
        assessedAt: daysAgo(0),
      },
    });
    summary.assessments += 1;

    const closed = await prisma.caseReferral.create({
      data: {
        studentId: student.id,
        advisorId: advisor2.id,
        acceptedByUserId: mh1.id,
        target: ReferralTarget.COUNSELING_CENTER,
        reason: `[${BULK_TAG}] ส่งต่อ MH — ปิดเคสหลังติดตามครบ`,
        status: ReferralStatus.CLOSED,
        staffNote: "ติดตามครบตามแผน",
        closedReason: "อาการดีขึ้นและปิดเคส",
      },
    });
    summary.referrals += 1;

    await prisma.mentalHealthAppointment.create({
      data: {
        studentId: student.id,
        mentalHealthUserId: mh1.id,
        referralId: closed.id,
        scheduledAt: daysAgo(4),
        location: "ห้องให้คำปรึกษา",
        note: `[${BULK_TAG}] นัดปิดเคส`,
        status: MentalHealthAppointmentStatus.COMPLETED,
      },
    });
    summary.appointments += 1;

    await prisma.alert.create({
      data: {
        recipientUserId: student.id,
        actorUserId: sd1.id,
        studentId: student.id,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.MEDIUM,
        title: "โปรดทำแบบประเมินสุขภาพจิตในระบบ NuCare",
        message: `[${BULK_TAG}] ประกาศจากฝ่ายพัฒนานักศึกษา: กรุณาทำแบบประเมินโดยเร็ว`,
        status: AlertStatus.OPEN,
        sourceType: "StudentDevelopmentReminder",
        sourceId: "showcase-reminder-8",
      },
    });
    summary.alerts += 1;
  }

  // แจ้งเตือนถึง executive (ถ้ามี) ให้แดชบอร์ดไม่ว่าง
  if (staff.executive) {
    await prisma.alert.create({
      data: {
        recipientUserId: staff.executive.id,
        actorUserId: staff.admin?.id ?? sd1.id,
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.LOW,
        title: `[${BULK_TAG}] สรุปสถานะดูแลนิสิตประจำสัปดาห์`,
        message: "มีเคสส่งต่อ/SOS/ความเสี่ยงสูงให้นำเสนอในที่ประชุม",
        status: AlertStatus.OPEN,
      },
    });
    summary.alerts += 1;
  }

  return summary;
}

async function seedBulk() {
  const staff = await requireStaff();
  const passwordHash = await bcrypt.hash(MOCK_PASSWORD, 10);

  console.log(`สร้างนิสิต ${STUDENT_COUNT} คน + เคสทดสอบครบสถานะ...`);

  const studentIds: string[] = [];

  for (let index = 1; index <= STUDENT_COUNT; index += 1) {
    const email = buildEmail(index);
    const studentId = buildStudentId(index);
    const studyYear = ((index - 1) % 4) + 1;
    const section = thaiSections[(index - 1) % thaiSections.length];
    const advisor = staff.advisors[(index - 1) % staff.advisors.length];

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { studentId }] },
      select: { id: true },
    });

    const user =
      existing != null
        ? await prisma.user.update({
            where: { id: existing.id },
            data: {
              name: `นิสิตทดสอบจำนวนมาก ${pad(index, 2)}`,
              email,
              studentId,
              studyYear,
              section,
              role: Role.STUDENT,
              additionalRoles: [],
              isActive: true,
              mustChangePassword: false,
              password: passwordHash,
              phone: `08${pad(10000000 + index, 8)}`.slice(0, 10),
              guardianPhone: `09${pad(20000000 + index, 8)}`.slice(0, 10),
            },
          })
        : await prisma.user.create({
            data: {
              name: `นิสิตทดสอบจำนวนมาก ${pad(index, 2)}`,
              email,
              studentId,
              studyYear,
              section,
              role: Role.STUDENT,
              additionalRoles: [],
              isActive: true,
              mustChangePassword: false,
              password: passwordHash,
              phone: `08${pad(10000000 + index, 8)}`.slice(0, 10),
              guardianPhone: `09${pad(20000000 + index, 8)}`.slice(0, 10),
            },
          });

    studentIds.push(user.id);

    const activeAssignment = await prisma.studentAdvisorAssignment.findFirst({
      where: { studentId: user.id, advisorId: advisor.id, isActive: true },
    });
    if (!activeAssignment) {
      await prisma.studentAdvisorAssignment.create({
        data: { studentId: user.id, advisorId: advisor.id, isActive: true },
      });
    }
  }

  let referralCount = 0;
  let consultationCount = 0;
  let emergencyCount = 0;
  let assessmentCount = 0;
  let behaviorCount = 0;
  let careCount = 0;
  let alertCount = 0;
  let appointmentCount = 0;
  let specializedCount = 0;
  let offerCount = 0;

  const consultationStatuses: ConsultationRequestStatus[] = [
    ConsultationRequestStatus.PENDING,
    ConsultationRequestStatus.ACCEPTED,
    ConsultationRequestStatus.SCHEDULED,
    ConsultationRequestStatus.CANCEL_REQUESTED,
    ConsultationRequestStatus.CLOSED,
    ConsultationRequestStatus.CANCELLED,
  ];

  for (let index = 0; index < studentIds.length; index += 1) {
    const studentId = studentIds[index];
    const advisor = staff.advisors[index % staff.advisors.length];
    const sdUser = staff.sdUsers[index % staff.sdUsers.length];
    const mhUser = staff.mhUsers[index % staff.mhUsers.length];
    const n = index + 1;

    const riskCycle = [RiskLevel.NORMAL, RiskLevel.MEDIUM, RiskLevel.HIGH][index % 3];
    const score =
      riskCycle === RiskLevel.HIGH
        ? 18 + (index % 5)
        : riskCycle === RiskLevel.MEDIUM
          ? 10 + (index % 5)
          : 2 + (index % 4);

    await prisma.studentAssessment.create({
      data: {
        studentId,
        instrument: [AssessmentInstrument.Q9, AssessmentInstrument.ST5, AssessmentInstrument.Q2][
          index % 3
        ],
        totalScore: score,
        riskLevel: riskCycle,
        assessedAt: daysAgo(3 + (index % 20)),
      },
    });
    assessmentCount += 1;

    if (n % 2 === 0) {
      const status =
        n % 6 === 0
          ? ReferralStatus.CLOSED
          : n % 4 === 0
            ? ReferralStatus.ACCEPTED
            : ReferralStatus.PENDING;
      await prisma.caseReferral.create({
        data: {
          studentId,
          advisorId: advisor.id,
          acceptedByUserId: status === ReferralStatus.PENDING ? null : sdUser.id,
          target: ReferralTarget.STUDENT_DEVELOPMENT,
          reason: `[${BULK_TAG}] ส่งต่อสวัสดิการ — นิสิต #${n} ต้องการช่วยเหลือเรื่องที่พัก/ทุน`,
          isUrgent: n % 5 === 0,
          status,
          staffNote: status === ReferralStatus.PENDING ? null : "รับเรื่องแล้วกำลังประสาน",
          closedReason: status === ReferralStatus.CLOSED ? "ช่วยเหลือเรียบร้อยแล้ว" : null,
          createdAt: daysAgo(1 + (index % 14)),
        },
      });
      referralCount += 1;
    }

    if (n % 3 === 0) {
      const status =
        n % 9 === 0
          ? ReferralStatus.CLOSED
          : n % 6 === 0
            ? ReferralStatus.ACCEPTED
            : ReferralStatus.PENDING;
      const referral = await prisma.caseReferral.create({
        data: {
          studentId,
          advisorId: advisor.id,
          acceptedByUserId: status === ReferralStatus.PENDING ? null : mhUser.id,
          target: ReferralTarget.COUNSELING_CENTER,
          reason: `[${BULK_TAG}] ส่งต่อสุขภาพจิต — นิสิต #${n} มีสัญญาณความเครียด`,
          isUrgent: riskCycle === RiskLevel.HIGH || n % 7 === 0,
          status,
          staffNote: status === ReferralStatus.PENDING ? null : "รับเคสและวางแผนดูแล",
          closedReason: status === ReferralStatus.CLOSED ? "ปิดเคสหลังติดตามครบ" : null,
          createdAt: daysAgo(2 + (index % 10)),
        },
      });
      referralCount += 1;

      if (status === ReferralStatus.ACCEPTED || status === ReferralStatus.CLOSED) {
        await prisma.specializedCareRecord.create({
          data: {
            studentId,
            mentalHealthUserId: mhUser.id,
            referralId: referral.id,
            sessionDate: daysAgo(1 + (index % 5)),
            summary: `[${BULK_TAG}] สรุปการดูแลนิสิต #${n}`,
            interventionPlan: "นัดติดตามและฝึกทักษะจัดการความเครียด",
            confidentialNotes: "บันทึกภายในทีม",
          },
        });
        specializedCount += 1;

        const apptStatus =
          status === ReferralStatus.CLOSED
            ? MentalHealthAppointmentStatus.COMPLETED
            : [MentalHealthAppointmentStatus.SCHEDULED, MentalHealthAppointmentStatus.NO_SHOW][
                index % 2
              ];

        await prisma.mentalHealthAppointment.create({
          data: {
            studentId,
            mentalHealthUserId: mhUser.id,
            referralId: referral.id,
            scheduledAt:
              apptStatus === MentalHealthAppointmentStatus.SCHEDULED
                ? daysFromNow(2 + (index % 8))
                : daysAgo(2 + (index % 5)),
            location: index % 2 === 0 ? "ห้องให้คำปรึกษา ชั้น 2" : "ออนไลน์",
            note: `[${BULK_TAG}] นัดติดตาม #${n}`,
            status: apptStatus,
          },
        });
        appointmentCount += 1;

        if (status === ReferralStatus.ACCEPTED && n % 12 === 0) {
          await prisma.mentalHealthScheduleOffer.create({
            data: {
              referralId: referral.id,
              proposedById: mhUser.id,
              proposedAt: daysFromNow(5),
              location: `[${BULK_TAG}] ห้องให้คำปรึกษา`,
              note: `[${BULK_TAG}] ข้อเสนอนัด #${n}`,
              status: ConsultationOfferStatus.PENDING,
            },
          });
          offerCount += 1;
        }
      }

      if (status === ReferralStatus.PENDING) {
        const otherMh = staff.mhUsers.find((u) => u.id !== mhUser.id);
        if (otherMh && n % 6 === 3) {
          await prisma.caseReferralDecline.create({
            data: { referralId: referral.id, userId: otherMh.id },
          });
        }

        await prisma.alert.create({
          data: {
            recipientUserId: mhUser.id,
            actorUserId: advisor.id,
            studentId,
            type: AlertType.REFERRAL_RECEIVED,
            priority: riskCycle === RiskLevel.HIGH ? AlertPriority.HIGH : AlertPriority.MEDIUM,
            title: `[${BULK_TAG}] มีเคสส่งต่อสุขภาพจิตใหม่`,
            message: `นิสิต #${n} ถูกส่งต่อมายังทีมสุขภาพจิต`,
            status: AlertStatus.OPEN,
            sourceType: "CaseReferral",
            sourceId: referral.id,
          },
        });
        alertCount += 1;
      }
    }

    if (n % 2 === 1) {
      const status = consultationStatuses[index % consultationStatuses.length];
      const req = await prisma.consultationRequest.create({
        data: {
          studentId,
          teacherId: advisor.id,
          topic: `[${BULK_TAG}] ขอปรึกษาเรื่องเรียน #${n}`,
          preferredChannel: [
            ConsultationPreferredChannel.IN_PERSON,
            ConsultationPreferredChannel.ONLINE,
            ConsultationPreferredChannel.PHONE,
            ConsultationPreferredChannel.MESSAGE,
          ][index % 4],
          note: "ขอคำแนะนำเพิ่มเติม",
          status,
          advisorNote: status === ConsultationRequestStatus.PENDING ? null : "รับเรื่องแล้ว",
          scheduledAt:
            status === ConsultationRequestStatus.SCHEDULED ||
            status === ConsultationRequestStatus.CLOSED ||
            status === ConsultationRequestStatus.CANCEL_REQUESTED
              ? daysFromNow(1 + (index % 6))
              : null,
          scheduleLocation:
            status === ConsultationRequestStatus.SCHEDULED ||
            status === ConsultationRequestStatus.CLOSED ||
            status === ConsultationRequestStatus.CANCEL_REQUESTED
              ? "ห้องที่ปรึกษา"
              : null,
          acceptedAt:
            status === ConsultationRequestStatus.PENDING ||
            status === ConsultationRequestStatus.CANCELLED
              ? null
              : daysAgo(1),
          closedAt:
            status === ConsultationRequestStatus.CLOSED ||
            status === ConsultationRequestStatus.CANCELLED
              ? daysAgo(0)
              : null,
          createdAt: daysAgo(index % 12),
        },
      });
      consultationCount += 1;

      if (status === ConsultationRequestStatus.ACCEPTED && n % 10 === 1) {
        await prisma.consultationScheduleOffer.create({
          data: {
            requestId: req.id,
            proposedById: advisor.id,
            proposedAt: daysFromNow(2),
            location: `[${BULK_TAG}] ห้องที่ปรึกษา`,
            note: `[${BULK_TAG}] ข้อเสนอนัด #${n}`,
            status: ConsultationOfferStatus.PENDING,
          },
        });
        offerCount += 1;
      }

      if (status === ConsultationRequestStatus.PENDING) {
        await prisma.alert.create({
          data: {
            recipientUserId: advisor.id,
            actorUserId: studentId,
            studentId,
            type: AlertType.ADVISOR_FOLLOW_UP,
            priority: AlertPriority.MEDIUM,
            title: `[${BULK_TAG}] มีคำขอปรึกษาใหม่`,
            message: `นิสิต #${n} ขอปรึกษาเรื่องเรียน`,
            status: AlertStatus.OPEN,
          },
        });
        alertCount += 1;
      }
    }

    if (n % 8 === 0) {
      const status =
        n % 24 === 0
          ? EmergencyCaseStatus.RESOLVED
          : n % 16 === 0
            ? EmergencyCaseStatus.IN_PROGRESS
            : EmergencyCaseStatus.OPEN;
      await prisma.emergencyCase.create({
        data: {
          studentId,
          reportedByUserId: studentId,
          summary: `[${BULK_TAG}] SOS จากนิสิต #${n} — ต้องการความช่วยเหลือด่วน`,
          status,
          openedAt: daysAgo(index % 5),
          resolvedAt: status === EmergencyCaseStatus.RESOLVED ? daysAgo(0) : null,
        },
      });
      emergencyCount += 1;

      for (const recipient of [...staff.sdUsers, ...staff.mhUsers, advisor]) {
        await prisma.alert.create({
          data: {
            recipientUserId: recipient.id,
            actorUserId: studentId,
            studentId,
            type: AlertType.SOS_OPENED,
            priority: AlertPriority.CRITICAL,
            title: `[${BULK_TAG}] SOS เปิดเคส`,
            message: `นิสิต #${n} กด SOS`,
            status: status === EmergencyCaseStatus.RESOLVED ? AlertStatus.CLOSED : AlertStatus.OPEN,
          },
        });
        alertCount += 1;
      }
    }

    if (n % 4 === 0) {
      await prisma.behaviorRecord.create({
        data: {
          studentId,
          instructorId: advisor.id,
          observedAt: daysAgo(2 + (index % 7)),
          category: "การเข้าชั้นเรียน",
          details: `[${BULK_TAG}] สังเกตนิสิต #${n} ขาดเรียนบ่อย`,
          severity: [BehaviorSeverity.LOW, BehaviorSeverity.MEDIUM, BehaviorSeverity.HIGH][
            index % 3
          ],
        },
      });
      behaviorCount += 1;
    }

    if (n % 3 === 1) {
      await prisma.careRecord.create({
        data: {
          studentId,
          advisorId: advisor.id,
          careDate: daysAgo(1 + (index % 9)),
          careType: "ติดตามผล",
          topic: `[${BULK_TAG}] การดูแลนิสิต #${n}`,
          action: "พูดคุยและให้คำแนะนำ",
          outcome: "นิสิตรับทราบและจะติดตามต่อ",
        },
      });
      careCount += 1;
    }

    if (n % 5 === 0) {
      await prisma.alert.create({
        data: {
          recipientUserId: studentId,
          actorUserId: sdUser.id,
          studentId,
          type: AlertType.ADVISOR_FOLLOW_UP,
          priority: AlertPriority.MEDIUM,
          title: "โปรดทำแบบประเมินสุขภาพจิตในระบบ NuCare",
          message: `[${BULK_TAG}] ประกาศจากฝ่ายพัฒนานักศึกษา: กรุณาทำแบบประเมินสุขภาพจิตโดยเร็วที่สุด`,
          status: AlertStatus.OPEN,
          sourceType: "StudentDevelopmentReminder",
          sourceId: `bulk-reminder-${n}`,
        },
      });
      alertCount += 1;
    }

    if (riskCycle === RiskLevel.HIGH) {
      await prisma.alert.create({
        data: {
          recipientUserId: advisor.id,
          actorUserId: studentId,
          studentId,
          type: AlertType.HIGH_RISK_SCREENING,
          priority: AlertPriority.HIGH,
          title: `[${BULK_TAG}] ผลคัดกรองความเสี่ยงสูง`,
          message: `นิสิต #${n} ได้คะแนนในเกณฑ์เสี่ยงสูง`,
          status: AlertStatus.OPEN,
        },
      });
      alertCount += 1;
    }
  }

  const exampleStudents = await prisma.user.findMany({
    where: { email: { in: [...EXAMPLE_STUDENT_EMAILS] }, isActive: true },
    select: { id: true },
  });
  const surveyStudentIds = [...studentIds, ...exampleStudents.map((u) => u.id)];

  const showcase = await seedShowcase(staff);
  const auditCount = await seedAuditGallery(staff);
  const surveyCount = await seedSurveyResponses(surveyStudentIds);

  console.log("—— สรุป bulk ——");
  console.log(`students: ${studentIds.length}`);
  console.log(`assessments: ${assessmentCount}`);
  console.log(`referrals: ${referralCount}`);
  console.log(`consultations: ${consultationCount}`);
  console.log(`emergencies: ${emergencyCount}`);
  console.log(`behaviors: ${behaviorCount}`);
  console.log(`careRecords: ${careCount}`);
  console.log(`mhAppointments: ${appointmentCount}`);
  console.log(`specializedCare: ${specializedCount}`);
  console.log(`scheduleOffers: ${offerCount}`);
  console.log(`alerts: ${alertCount}`);
  console.log("—— สรุป showcase บัญชีตัวอย่าง ——");
  console.log(JSON.stringify(showcase));
  console.log(`audits: ${auditCount}`);
  console.log(`surveyResponses: ${surveyCount}`);
  console.log(`password: ${MOCK_PASSWORD}`);
  console.log(`ตัวอย่าง login bulk: ${buildEmail(1)} / ${buildStudentId(1)}`);
  console.log("ดูเคสชัด ๆ: student1–8.example@nucare.local (รหัสเดียวกัน)");
  console.log("ลบทีหลัง: npx tsx scripts/temp-bulk-demo-data.ts --cleanup");
}

async function main() {
  const cleanupOnly = process.argv.includes("--cleanup");
  if (cleanupOnly) {
    await cleanup();
    return;
  }

  await cleanup();
  await seedBulk();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
