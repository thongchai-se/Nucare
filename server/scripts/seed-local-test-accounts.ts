/**
 * Seed บัญชีจำลองสำหรับเทสมือ — ชื่อมีคำว่า「ตัวอย่าง」ครบ
 * Admin จริงมีคนเดียว: adminnucare@gmail.com (รหัสจาก ADMIN_SEED_PASSWORD)
 *
 * รัน:
 *   npx tsx scripts/seed-local-test-accounts.ts
 */
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

/** รหัสผ่านร่วมของบัญชีจำลอง (ไม่ใช่ admin) */
const MOCK_PASSWORD = "NucareTest!2026";

type SeedAccount = {
  name: string;
  email: string;
  studentId?: string;
  employeeId?: string;
  studyYear?: number;
  section?: string;
  role: Role;
  additionalRoles: Role[];
  /** true = ใช้รหัส admin จาก env และอัปเดตรหัสทุกครั้งที่ seed */
  isRealAdmin?: boolean;
};

const accounts: SeedAccount[] = [
  // --- นิสิต: หลายชั้นปี/กลุ่ม เพื่อเทสแบบประเมิน / คำขอปรึกษา / SOS / แชท ---
  {
    name: "นักศึกษา ตัวอย่าง1",
    email: "student1.example@nucare.local",
    studentId: "681100001-1",
    studyYear: 1,
    section: "A",
    role: Role.STUDENT,
    additionalRoles: [],
  },
  {
    name: "นักศึกษา ตัวอย่าง2",
    email: "student2.example@nucare.local",
    studentId: "681100002-2",
    studyYear: 1,
    section: "B",
    role: Role.STUDENT,
    additionalRoles: [],
  },
  {
    name: "นักศึกษา ตัวอย่าง3",
    email: "student3.example@nucare.local",
    studentId: "681100003-3",
    studyYear: 2,
    section: "A",
    role: Role.STUDENT,
    additionalRoles: [],
  },
  {
    name: "นักศึกษา ตัวอย่าง4",
    email: "student4.example@nucare.local",
    studentId: "681100004-4",
    studyYear: 2,
    section: "B",
    role: Role.STUDENT,
    additionalRoles: [],
  },
  {
    name: "นักศึกษา ตัวอย่าง5",
    email: "student5.example@nucare.local",
    studentId: "681100005-5",
    studyYear: 3,
    section: "A",
    role: Role.STUDENT,
    additionalRoles: [],
  },
  {
    name: "นักศึกษา ตัวอย่าง6",
    email: "student6.example@nucare.local",
    studentId: "681100006-6",
    studyYear: 3,
    section: "B",
    role: Role.STUDENT,
    additionalRoles: [],
  },
  {
    name: "นักศึกษา ตัวอย่าง7",
    email: "student7.example@nucare.local",
    studentId: "681100007-7",
    studyYear: 4,
    section: "A",
    role: Role.STUDENT,
    additionalRoles: [],
  },
  {
    name: "นักศึกษา ตัวอย่าง8",
    email: "student8.example@nucare.local",
    studentId: "681100008-8",
    studyYear: 4,
    section: "B",
    role: Role.STUDENT,
    additionalRoles: [],
  },

  // --- ที่ปรึกษา 2 คน: เทสมอบหมาย / ปรึกษา / ส่งต่อ / เจรจานัด ---
  {
    name: "อาจารย์ที่ปรึกษา ตัวอย่าง1",
    email: "advisor1.example@nucare.local",
    employeeId: "ADV-EX-001",
    role: Role.ADVISOR,
    additionalRoles: [],
  },
  {
    name: "อาจารย์ที่ปรึกษา ตัวอย่าง2",
    email: "advisor2.example@nucare.local",
    employeeId: "ADV-EX-002",
    role: Role.ADVISOR,
    additionalRoles: [],
  },

  // --- งานพัฒนานิสิต ---
  {
    name: "งานพัฒนานิสิต ตัวอย่าง1",
    email: "sd1.example@nucare.local",
    employeeId: "SD-EX-001",
    role: Role.STUDENT_DEVELOPMENT,
    additionalRoles: [],
  },
  {
    name: "งานพัฒนานิสิต ตัวอย่าง2",
    email: "sd2.example@nucare.local",
    employeeId: "SD-EX-002",
    role: Role.STUDENT_DEVELOPMENT,
    additionalRoles: [],
  },

  // --- ทีมสุขภาพจิต 2 คน: เทสคิว / รับเคส / นัด ---
  {
    name: "ทีมสุขภาพจิต ตัวอย่าง1",
    email: "mh1.example@nucare.local",
    employeeId: "MH-EX-001",
    role: Role.MENTAL_HEALTH,
    additionalRoles: [],
  },
  {
    name: "ทีมสุขภาพจิต ตัวอย่าง2",
    email: "mh2.example@nucare.local",
    employeeId: "MH-EX-002",
    role: Role.MENTAL_HEALTH,
    additionalRoles: [],
  },

  // --- ผู้บริหาร ---
  {
    name: "ผู้บริหาร ตัวอย่าง1",
    email: "executive1.example@nucare.local",
    employeeId: "EXE-EX-001",
    role: Role.EXECUTIVE,
    additionalRoles: [],
  },

  // --- หลายบทบาท (ไม่มี ADMIN) เพื่อเทสสลับ role ---
  {
    name: "บุคลากรหลายบทบาท ตัวอย่าง1",
    email: "multi.sd-advisor.example@nucare.local",
    employeeId: "MULTI-EX-SA-001",
    role: Role.STUDENT_DEVELOPMENT,
    additionalRoles: [Role.ADVISOR],
  },
  {
    name: "บุคลากรหลายบทบาท ตัวอย่าง2",
    email: "multi.staff.example@nucare.local",
    employeeId: "MULTI-EX-ALL-001",
    role: Role.EXECUTIVE,
    additionalRoles: [
      Role.STUDENT_DEVELOPMENT,
      Role.MENTAL_HEALTH,
      Role.ADVISOR,
    ],
  },

  // --- Admin จริงคนเดียว ---
  {
    name: "ผู้ดูแลระบบ ตัวอย่าง",
    email: "adminnucare@gmail.com",
    employeeId: "ADM-EX-001",
    role: Role.ADMIN,
    additionalRoles: [],
    isRealAdmin: true,
  },
];

const LEGACY_ADMIN_EMAILS = [
  "admin@nucare.local",
  "admin.test@nucare.local",
];

const LEGACY_MOCK_EMAILS = [
  "student.test@nucare.local",
  "student2.test@nucare.local",
  "student3.test@nucare.local",
  "advisor.test@nucare.local",
  "advisor.peer@nucare.local",
  "sd.test@nucare.local",
  "mh.test@nucare.local",
  "executive.test@nucare.local",
  "instructor.test@nucare.local",
  "multi.sd-advisor@nucare.local",
  "multi.all-staff@nucare.local",
  "multi.advisor-instructor@nucare.local",
];

const prisma = new PrismaClient();

const readAdminPassword = (): string => {
  const password = process.env.ADMIN_SEED_PASSWORD?.trim() || process.env.DEFAULT_SEED_PASSWORD?.trim();
  if (!password || password.length < 8) {
    throw new Error(
      "ต้องตั้ง ADMIN_SEED_PASSWORD (หรือ DEFAULT_SEED_PASSWORD) ยาวอย่างน้อย 8 ตัว สำหรับบัญชี adminnucare@gmail.com"
    );
  }
  return password;
};

/** ย้ายบัญชี INSTRUCTOR เก่าทั้งหมดไปเป็น ADVISOR */
async function collapseInstructorRolesInDatabase() {
  const instructors = await prisma.user.findMany({
    where: {
      OR: [{ role: Role.INSTRUCTOR }, { additionalRoles: { has: Role.INSTRUCTOR } }],
    },
    select: { id: true, role: true, additionalRoles: true, email: true },
  });

  for (const user of instructors) {
    const primaryRole = user.role === Role.INSTRUCTOR ? Role.ADVISOR : user.role;
    const additionalRoles = Array.from(
      new Set(
        user.additionalRoles
          .filter((role) => role !== Role.INSTRUCTOR)
          .concat(user.role !== Role.INSTRUCTOR && user.role !== Role.ADVISOR ? [Role.ADVISOR] : [])
      )
    ).filter((role) => role !== primaryRole);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: primaryRole,
        additionalRoles,
      },
    });
    console.log(`collapsed INSTRUCTOR → ADVISOR: ${user.email || user.id}`);
  }

  await prisma.studentInstructorAssignment.updateMany({
    data: { isActive: false },
  });

  await prisma.studentAdvisorAssignment.updateMany({
    where: {
      isActive: true,
      advisor: { isActive: false },
    },
    data: { isActive: false },
  });
}

async function upsertAccount(account: SeedAccount, passwordHash: string) {
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: account.email },
        account.studentId ? { studentId: account.studentId } : undefined,
        account.employeeId ? { employeeId: account.employeeId } : undefined,
      ].filter(Boolean) as Array<{ email?: string; studentId?: string; employeeId?: string }>,
    },
  });

  const data = {
    name: account.name,
    email: account.email.toLowerCase(),
    studentId: account.studentId || null,
    employeeId: account.employeeId || null,
    studyYear: account.studyYear || null,
    section: account.section || null,
    role: account.role,
    additionalRoles: account.additionalRoles,
    isActive: true,
    mustChangePassword: false,
    password: passwordHash,
  };

  if (existing) {
    return prisma.user.update({ where: { id: existing.id }, data });
  }

  return prisma.user.create({ data });
}

async function ensureAdvisor(studentId: string, advisorId: string) {
  const existing = await prisma.studentAdvisorAssignment.findFirst({
    where: { studentId, advisorId, isActive: true },
  });
  if (!existing) {
    await prisma.studentAdvisorAssignment.create({
      data: { studentId, advisorId, isActive: true },
    });
  }
}

async function deactivateLegacyAccounts() {
  const emails = [...LEGACY_ADMIN_EMAILS, ...LEGACY_MOCK_EMAILS];
  const result = await prisma.user.updateMany({
    where: {
      email: { in: emails.map((email) => email.toLowerCase()) },
      NOT: { email: "adminnucare@gmail.com" },
    },
    data: {
      isActive: false,
      name: "(ปิดใช้) บัญชีทดสอบเดิม",
    },
  });
  console.log(`deactivated legacy accounts: ${result.count}`);
}

async function main() {
  await collapseInstructorRolesInDatabase();

  const mockPasswordHash = await bcrypt.hash(MOCK_PASSWORD, 10);
  const adminPasswordHash = await bcrypt.hash(readAdminPassword(), 12);
  const ids: Record<string, string> = {};

  for (const account of accounts) {
    const passwordHash = account.isRealAdmin ? adminPasswordHash : mockPasswordHash;
    const user = await upsertAccount(account, passwordHash);
    ids[account.email.toLowerCase()] = user.id;
    console.log(`${account.role} ${account.email} ← ${account.name}`);
  }

  await deactivateLegacyAccounts();

  // นิสิต 1–4 → ที่ปรึกษา 1, นิสิต 5–8 → ที่ปรึกษา 2
  // multi SD+advisor ผูกนิสิตกลุ่มแรกด้วย เพื่อเทสหลายที่ปรึกษา
  const advisor1 = ids["advisor1.example@nucare.local"];
  const advisor2 = ids["advisor2.example@nucare.local"];
  const multiAdvisor = ids["multi.sd-advisor.example@nucare.local"];

  const group1 = [
    "student1.example@nucare.local",
    "student2.example@nucare.local",
    "student3.example@nucare.local",
    "student4.example@nucare.local",
  ];
  const group2 = [
    "student5.example@nucare.local",
    "student6.example@nucare.local",
    "student7.example@nucare.local",
    "student8.example@nucare.local",
  ];

  for (const email of group1) {
    await ensureAdvisor(ids[email], advisor1);
    await ensureAdvisor(ids[email], multiAdvisor);
  }
  for (const email of group2) {
    await ensureAdvisor(ids[email], advisor2);
  }

  console.log("seed-local-test-accounts done");
  console.log(`mock password (non-admin): ${MOCK_PASSWORD}`);
  console.log("admin: adminnucare@gmail.com (password from ADMIN_SEED_PASSWORD, not printed)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
