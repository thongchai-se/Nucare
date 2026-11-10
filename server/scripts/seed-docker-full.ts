/**
 * ล้าง Docker Postgres แล้ว seed ครบสำหรับลองทุก role
 * - บัญชีบุคลากรมาตรฐาน
 * - นิสิต 200 คน + ผูกที่ปรึกษา
 * - เคส walkthrough / คำขอปรึกษา / ส่งต่อ / สัญญาณ
 *
 * รัน:
 *   $env:DATABASE_URL="postgresql://nucare:nucare_password@localhost:5432/nucare?schema=public"
 *   npx tsx scripts/seed-docker-full.ts
 *
 * รหัสผ่านร่วม: NucareTest!2026
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import {
  ConsultationPreferredChannel,
  ConsultationRequestStatus,
  PrismaClient,
  ReferralStatus,
  ReferralTarget,
  Role,
} from "@prisma/client";

const prisma = new PrismaClient();
const PASSWORD = "NucareTest!2026";
const STUDENT_TOTAL = 200;
const MARKER = "[FULL-SEED]";

const FIRST_MALE = [
  "ภูมิพัฒน์",
  "ธนกฤต",
  "กิตติพงษ์",
  "ศุภชัย",
  "ณัฐพล",
  "วรเมธ",
  "พีรพัฒน์",
  "อนุชา",
  "ชัยวัฒน์",
  "ธีรพงศ์",
  "อภิสิทธิ์",
  "ปิยะพงษ์",
  "สรพงษ์",
  "กฤษณะ",
  "พงศกร",
  "ธนากร",
  "วชิรวิทย์",
  "ณัฐวุฒิ",
  "ศิริพงษ์",
  "พัชรพล",
];
const FIRST_FEMALE = [
  "กมลวรรณ",
  "พิมพ์ใจ",
  "สุภาพร",
  "นภัสสร",
  "อรุณี",
  "วราภรณ์",
  "ชนิกานต์",
  "ปภาวดี",
  "มัลลิกา",
  "จิราพร",
  "กัญญารัตน์",
  "ศิริลักษณ์",
  "ณัฐธิดา",
  "อลิษา",
  "ปาริฉัตร",
  "ธัญญรัตน์",
  "อรนุช",
  "ชุติมา",
  "ณิชากร",
  "พัชรินทร์",
];
const LAST_NAMES = [
  "ใจดี",
  "สุขใจ",
  "อรุณรุ่ง",
  "ศรีสุข",
  "ทองดี",
  "บุญมี",
  "แก้วใจ",
  "วงศ์ทอง",
  "พงษ์ดี",
  "รัตนะ",
  "จันทร์เพ็ญ",
  "ศรีทอง",
  "วัฒนกุล",
  "บุญเลิศ",
  "สมบัติ",
  "อินทร์ทอง",
  "นาคทอง",
  "เพชรรัตน์",
  "สุวรรณโชติ",
  "กิตติศักดิ์",
];

type StaffAccount = {
  name: string;
  email: string;
  employeeId: string;
  role: Role;
  additionalRoles: Role[];
};

const STAFF: StaffAccount[] = [
  {
    name: "อ.ดร. สุภาวดี ที่ปรึกษา",
    email: "advisor.test@nucare.local",
    employeeId: "ADV-TEST-001",
    role: Role.ADVISOR,
    additionalRoles: [],
  },
  {
    name: "ผศ.ดร. วิชัย ที่ปรึกษา",
    email: "advisor.peer@nucare.local",
    employeeId: "ADV-PEER-001",
    role: Role.ADVISOR,
    additionalRoles: [],
  },
  {
    name: "นางสาว พิมพ์ใจ พัฒนานิสิต",
    email: "sd.test@nucare.local",
    employeeId: "SD-TEST-001",
    role: Role.STUDENT_DEVELOPMENT,
    additionalRoles: [],
  },
  {
    name: "อ.ดร. มาลี สุขภาพจิต",
    email: "mh.test@nucare.local",
    employeeId: "MH-TEST-001",
    role: Role.MENTAL_HEALTH,
    additionalRoles: [],
  },
  {
    name: "รศ.ดร. ประเสริฐ ผู้บริหาร",
    email: "executive.test@nucare.local",
    employeeId: "EXE-TEST-001",
    role: Role.EXECUTIVE,
    additionalRoles: [],
  },
  {
    name: "นาย อดิศักดิ์ ผู้ดูแลระบบ",
    email: "admin.test@nucare.local",
    employeeId: "ADM-TEST-001",
    role: Role.ADMIN,
    additionalRoles: [],
  },
  {
    name: "นางสาว อรอุมา พัฒนาและที่ปรึกษา",
    email: "multi.sd-advisor@nucare.local",
    employeeId: "MULTI-SA-001",
    role: Role.STUDENT_DEVELOPMENT,
    additionalRoles: [Role.ADVISOR],
  },
  {
    name: "นาย เกรียงไกร ครบบุคลากร",
    email: "multi.all-staff@nucare.local",
    employeeId: "MULTI-ALL-001",
    role: Role.ADMIN,
    additionalRoles: [
      Role.EXECUTIVE,
      Role.STUDENT_DEVELOPMENT,
      Role.MENTAL_HEALTH,
      Role.ADVISOR,
    ],
  },
];

const NAMED_STUDENTS = [
  {
    index: 1,
    name: "นาย ภูมิพัฒน์ ใจดี",
    email: "student.test@nucare.local",
    studentId: "681100001-1",
    studyYear: 2,
    section: "A",
  },
  {
    index: 2,
    name: "นางสาว กมลวรรณ สุขใจ",
    email: "student2.test@nucare.local",
    studentId: "681100002-2",
    studyYear: 3,
    section: "B",
  },
  {
    index: 3,
    name: "นาย ธนกฤต อรุณรุ่ง",
    email: "student3.test@nucare.local",
    studentId: "681100003-3",
    studyYear: 1,
    section: "A",
  },
] as const;

/** ล้างตารางทั้งหมดใน schema public (คงโครงสร้างไว้) */
async function wipeAllTables() {
  const rows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );

  const tables = rows
    .map((row) => row.tablename)
    .filter((name) => name && name !== "_prisma_migrations");

  if (tables.length === 0) {
    console.log("ไม่มีตารางให้ล้าง");
    return;
  }

  const quoted = tables.map((name) => `"${name}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  console.log(`ล้างตาราง ${tables.length} ตารางแล้ว`);
}

/** สร้างชื่อไม่ซ้ำจากคู่ (ชื่อจริง, นามสกุล) คนละเพศ — เลี่ยงชื่อที่จองแล้ว */
function bulkStudentName(index: number, reservedNames: ReadonlySet<string>): string {
  const zeroBased = index - 1;
  const female = zeroBased % 2 === 0;
  const pairIndex = Math.floor(zeroBased / 2);
  const firstPool = female ? FIRST_FEMALE : FIRST_MALE;
  const prefix = female ? "นางสาว" : "นาย";

  for (let offset = 0; offset < FIRST_MALE.length * LAST_NAMES.length; offset += 1) {
    const slot = pairIndex + offset;
    const first = firstPool[slot % firstPool.length];
    const last = LAST_NAMES[Math.floor(slot / firstPool.length) % LAST_NAMES.length];
    const candidate = `${prefix} ${first} ${last}`;
    if (!reservedNames.has(candidate)) {
      return candidate;
    }
  }

  return `${prefix} ทดสอบ${String(index).padStart(3, "0")} เฉพาะกิจ`;
}

function bulkStudentId(index: number): string {
  const base = 681100000 + index;
  return `${base}-${index % 10}`;
}

function bulkEmail(index: number): string {
  return `student.bulk.${String(index).padStart(3, "0")}@nucare.local`;
}

async function ensureAssignment(studentId: string, advisorId: string) {
  const existing = await prisma.studentAdvisorAssignment.findFirst({
    where: { studentId, advisorId },
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
    data: { studentId, advisorId, isActive: true },
  });
}

/** ผูกที่ปรึกษา: named → ทั้ง 3 ที่ปรึกษา; bulk แบ่งกลุ่มให้ค้นหาข้อสังเกตมีรายการ */
function advisorEmailsForStudentIndex(index: number): string[] {
  if (index <= 3) {
    return [
      "advisor.test@nucare.local",
      "advisor.peer@nucare.local",
      "multi.sd-advisor@nucare.local",
    ];
  }
  if (index <= 70) return ["advisor.test@nucare.local"];
  if (index <= 120) return ["advisor.peer@nucare.local"];
  if (index <= 160) return ["multi.sd-advisor@nucare.local"];
  return ["advisor.test@nucare.local", "multi.sd-advisor@nucare.local"];
}

function runScript(relativePath: string) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const full = path.join(scriptDir, relativePath);
  console.log(`\n=== รัน ${relativePath} ===`);
  execSync(`npx tsx "${full}"`, {
    stdio: "inherit",
    env: process.env,
    cwd: path.join(scriptDir, ".."),
  });
}

/** เติมเคสที่ยังขาด: CANCEL_REQUESTED + ส่งต่อสวัสดิการ */
async function seedExtraCases(ids: Record<string, string>) {
  const peerId = ids["advisor.peer@nucare.local"];
  const advisorTestId = ids["advisor.test@nucare.local"];
  const s2 = ids["student2.test@nucare.local"];
  const cancelStudentId = ids[bulkEmail(75)]; // peer advisee — ไม่ชนคิว walkthrough ของนิสิตทดสอบ
  const bulkForSd = ids[bulkEmail(80)];

  // คำขอที่นิสิตขอยกเลิก รออาจารย์ยืนยัน (peer)
  if (cancelStudentId) {
    await prisma.consultationRequest.create({
      data: {
        studentId: cancelStudentId,
        teacherId: peerId,
        topic: "การปรับตัวในมหาวิทยาลัย",
        preferredChannel: ConsultationPreferredChannel.MESSAGE,
        note: `${MARKER} นิสิตขอยกเลิก — รออาจารย์ยืนยัน`,
        status: ConsultationRequestStatus.CANCEL_REQUESTED,
        acceptedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
        advisorNote: "ขอยกเลิก — มีธุระด่วน · รออาจารย์ยืนยัน",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      },
    });
  }

  // ส่งต่องานพัฒนานิสิต (สวัสดิการ) — PENDING / ACCEPTED
  await prisma.caseReferral.create({
    data: {
      studentId: s2,
      advisorId: peerId,
      target: ReferralTarget.STUDENT_DEVELOPMENT,
      reason: `${MARKER} ส่งต่อสวัสดิการ — ทุนและค่าครองชีพ`,
      isUrgent: false,
      status: ReferralStatus.PENDING,
    },
  });

  if (bulkForSd) {
    await prisma.caseReferral.create({
      data: {
        studentId: bulkForSd,
        advisorId: peerId,
        target: ReferralTarget.STUDENT_DEVELOPMENT,
        reason: `${MARKER} สวัสดิการรับแล้ว — ติดตามทุนฉุกเฉิน`,
        isUrgent: true,
        status: ReferralStatus.ACCEPTED,
        acceptedByUserId: ids["sd.test@nucare.local"],
      },
    });
  }

  // คิวคำขอปรึกษาของอ.สุภาวดี — คนละนิสิต bulk ต่อสถานะ (ไม่ทับ walkthrough)
  const advisorDemo = [
    {
      studentEmail: bulkEmail(10),
      topic: "สุขภาพใจและความเครียด",
      status: ConsultationRequestStatus.PENDING,
      note: `${MARKER} รอรับ · อ.สุภาวดี`,
    },
    {
      studentEmail: bulkEmail(11),
      topic: "การเรียนและผลการเรียน",
      status: ConsultationRequestStatus.ACCEPTED,
      note: `${MARKER} รับแล้ว · อ.สุภาวดี`,
      acceptedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      studentEmail: bulkEmail(12),
      topic: "ทุนการศึกษาและค่าใช้จ่าย",
      status: ConsultationRequestStatus.SCHEDULED,
      note: `${MARKER} นัดแล้ว · อ.สุภาวดี`,
      acceptedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      scheduleLocation: "ห้องที่ปรึกษา B",
    },
    {
      studentEmail: bulkEmail(13),
      topic: "อื่น ๆ",
      status: ConsultationRequestStatus.CLOSED,
      note: `${MARKER} ปิดแล้ว · อ.สุภาวดี`,
      acceptedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      advisorNote: `${MARKER} พูดคุยแล้ว`,
    },
  ] as const;

  for (const row of advisorDemo) {
    const studentId = ids[row.studentEmail];
    if (!studentId) continue;
    await prisma.consultationRequest.create({
      data: {
        studentId,
        teacherId: advisorTestId,
        topic: row.topic,
        preferredChannel: ConsultationPreferredChannel.IN_PERSON,
        note: row.note,
        status: row.status,
        ...("acceptedAt" in row ? { acceptedAt: row.acceptedAt } : {}),
        ...("scheduledAt" in row ? { scheduledAt: row.scheduledAt, scheduleLocation: row.scheduleLocation } : {}),
        ...("closedAt" in row ? { closedAt: row.closedAt, advisorNote: row.advisorNote } : {}),
      },
    });
  }

  console.log("เติมเคส EXTRA: CANCEL_REQUESTED · สวัสดิการ · คิว advisor.test (bulk)");
}

async function main() {
  if (!process.env.DATABASE_URL?.includes("localhost:5432") && !process.env.ALLOW_FULL_SEED_REMOTE) {
    console.error(
      "ปฏิเสธ: DATABASE_URL ไม่ชี้ localhost:5432 — ตั้ง ALLOW_FULL_SEED_REMOTE=1 ถ้าตั้งใจล้าง DB อื่น"
    );
    process.exitCode = 1;
    return;
  }

  console.log("DATABASE_URL =", process.env.DATABASE_URL);
  await wipeAllTables();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const ids: Record<string, string> = {};

  for (const staff of STAFF) {
    const user = await prisma.user.create({
      data: {
        name: staff.name,
        email: staff.email,
        employeeId: staff.employeeId,
        role: staff.role,
        additionalRoles: staff.additionalRoles,
        password: passwordHash,
        isActive: true,
      },
    });
    ids[staff.email] = user.id;
    console.log(`staff ${staff.role} ${staff.email}`);
  }

  const reservedStudentNames = new Set<string>(NAMED_STUDENTS.map((row) => row.name));

  for (let index = 1; index <= STUDENT_TOTAL; index += 1) {
    const named = NAMED_STUDENTS.find((row) => row.index === index);
    const email = named?.email ?? bulkEmail(index);
    const name = named?.name ?? bulkStudentName(index, reservedStudentNames);
    const studentId = named?.studentId ?? bulkStudentId(index);
    const studyYear = named?.studyYear ?? ((index % 4) + 1);
    const section = named?.section ?? (index % 2 === 0 ? "A" : "B");

    reservedStudentNames.add(name);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        studentId,
        studyYear,
        section,
        role: Role.STUDENT,
        additionalRoles: [],
        password: passwordHash,
        isActive: true,
      },
    });
    ids[email] = user.id;

    for (const advisorEmail of advisorEmailsForStudentIndex(index)) {
      await ensureAssignment(user.id, ids[advisorEmail]);
    }

    if (index % 50 === 0 || index === STUDENT_TOTAL) {
      console.log(`students ${index}/${STUDENT_TOTAL}`);
    }
  }

  // walkthrough ก่อน — demo คำขอของอ.สุภาวดีใช้นิสิต bulk (ไม่ทับคิว peer ของนิสิตทดสอบ)
  runScript("seed-walkthrough-three-accounts.ts");
  await seedExtraCases(ids);

  const studentCount = await prisma.user.count({ where: { role: Role.STUDENT } });
  const peerAdvisees = await prisma.studentAdvisorAssignment.count({
    where: { advisorId: ids["advisor.peer@nucare.local"], isActive: true },
  });
  const otherForPeerObservation = await prisma.user.count({
    where: {
      role: Role.STUDENT,
      isActive: true,
      NOT: {
        studentAssignments: {
          some: { advisorId: ids["advisor.peer@nucare.local"], isActive: true },
        },
      },
    },
  });

  console.log("\n=== สรุป ===");
  console.log(`นิสิตทั้งหมด: ${studentCount}`);
  console.log(`นิสิตในดูแล peer (วิชัย): ${peerAdvisees}`);
  console.log(`นิสิตที่ peer ค้นหาแจ้งข้อสังเกตได้: ${otherForPeerObservation}`);
  console.log(`รหัสผ่านร่วม: ${PASSWORD}`);
  console.log("ดูบัญชีใน data.md");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
