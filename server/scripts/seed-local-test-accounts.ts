/**
 * Seed บัญชีทดสอบท้องถิ่น — ยุบบทบาทผู้สอนเข้าที่ปรึกษาแล้ว
 * รัน: npx tsx scripts/seed-local-test-accounts.ts
 */
import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const PASSWORD = "NucareTest!2026";

type SeedAccount = {
  name: string;
  email: string;
  studentId?: string;
  employeeId?: string;
  studyYear?: number;
  section?: string;
  role: Role;
  additionalRoles: Role[];
};

const accounts: SeedAccount[] = [
  {
    name: "นาย ภูมิพัฒน์ ใจดี",
    email: "student.test@nucare.local",
    studentId: "681100001-1",
    studyYear: 2,
    section: "A",
    role: Role.STUDENT,
    additionalRoles: [],
  },
  {
    name: "นางสาว กมลวรรณ สุขใจ",
    email: "student2.test@nucare.local",
    studentId: "681100002-2",
    studyYear: 3,
    section: "B",
    role: Role.STUDENT,
    additionalRoles: [],
  },
  {
    name: "นาย ธนกฤต อรุณรุ่ง",
    email: "student3.test@nucare.local",
    studentId: "681100003-3",
    studyYear: 1,
    section: "A",
    role: Role.STUDENT,
    additionalRoles: [],
  },
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

const prisma = new PrismaClient();

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

  // ปิด assignment ของบัญชีที่ไม่ active เพื่อไม่ให้ถูกแจ้งข้อสังเกต
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
    email: account.email,
    studentId: account.studentId || null,
    employeeId: account.employeeId || null,
    studyYear: account.studyYear || null,
    section: account.section || null,
    role: account.role,
    additionalRoles: account.additionalRoles,
    isActive: true,
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

async function main() {
  await collapseInstructorRolesInDatabase();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const ids: Record<string, string> = {};

  for (const account of accounts) {
    const user = await upsertAccount(account, passwordHash);
    ids[account.email] = user.id;
    console.log(`${account.role} ${account.email}`);
  }

  // ปิดบัญชีผู้สอนเก่าถ้ายังมีอีเมลเดิม
  await prisma.user.updateMany({
    where: { email: "instructor.test@nucare.local" },
    data: {
      isActive: false,
      role: Role.ADVISOR,
      additionalRoles: [],
      name: "(ปิดใช้) บัญชีผู้สอนเดิม",
    },
  });
  await prisma.user.updateMany({
    where: { email: "multi.advisor-instructor@nucare.local" },
    data: {
      isActive: false,
      role: Role.ADVISOR,
      additionalRoles: [],
      name: "(ปิดใช้) บัญชี multi ผู้สอนเดิม",
    },
  });

  const studentEmails = [
    "student.test@nucare.local",
    "student2.test@nucare.local",
    "student3.test@nucare.local",
  ];
  const advisorEmails = ["advisor.test@nucare.local", "multi.sd-advisor@nucare.local"];

  for (const studentEmail of studentEmails) {
    const studentId = ids[studentEmail];
    for (const advisorEmail of advisorEmails) {
      await ensureAdvisor(studentId, ids[advisorEmail]);
    }
  }

  console.log("seed-local-test-accounts done (instructor role collapsed)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
