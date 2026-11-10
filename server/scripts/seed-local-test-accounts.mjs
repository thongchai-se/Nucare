/**
 * One-off local Docker seed for secrets/test-accounts.md
 * Usage: DATABASE_URL=... node scripts/seed-local-test-accounts.mjs
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const PASSWORD = "NucareTest!2026";
const prisma = new PrismaClient();

const users = [
  {
    name: "นักศึกษาทดสอบ",
    role: Role.STUDENT,
    studentId: "681100001-1",
    email: "student.test@nucare.local",
    studyYear: 1,
    section: "A",
  },
  {
    name: "นักศึกษาทดสอบ 2",
    role: Role.STUDENT,
    studentId: "681100002-2",
    email: "student2.test@nucare.local",
    studyYear: 2,
    section: "B",
  },
  {
    name: "อาจารย์ที่ปรึกษาทดสอบ",
    role: Role.ADVISOR,
    employeeId: "ADV-TEST-001",
    email: "advisor.test@nucare.local",
  },
  {
    name: "ฝ่ายพัฒนานักศึกษาทดสอบ",
    role: Role.STUDENT_DEVELOPMENT,
    employeeId: "SD-TEST-001",
    email: "sd.test@nucare.local",
  },
  {
    name: "ทีมสุขภาพจิตทดสอบ",
    role: Role.MENTAL_HEALTH,
    employeeId: "MH-TEST-001",
    email: "mh.test@nucare.local",
  },
  {
    name: "ผู้สอนทดสอบ",
    role: Role.INSTRUCTOR,
    employeeId: "INS-TEST-001",
    email: "instructor.test@nucare.local",
  },
  {
    name: "ผู้บริหารทดสอบ",
    role: Role.EXECUTIVE,
    employeeId: "EXE-TEST-001",
    email: "executive.test@nucare.local",
  },
  {
    name: "ผู้ดูแลระบบทดสอบ",
    role: Role.ADMIN,
    employeeId: "ADM-TEST-001",
    email: "admin.test@nucare.local",
  },
  {
    name: "หลายบทบาท ที่ปรึกษาและผู้สอน",
    role: Role.ADVISOR,
    additionalRoles: [Role.INSTRUCTOR],
    employeeId: "MULTI-AI-001",
    email: "multi.ai@nucare.local",
  },
  {
    name: "หลายบทบาท พัฒนาและที่ปรึกษา",
    role: Role.STUDENT_DEVELOPMENT,
    additionalRoles: [Role.ADVISOR],
    employeeId: "MULTI-SA-001",
    email: "multi.sa@nucare.local",
  },
  {
    name: "หลายบทบาท ครบบุคลากร",
    role: Role.ADMIN,
    additionalRoles: [
      Role.EXECUTIVE,
      Role.STUDENT_DEVELOPMENT,
      Role.MENTAL_HEALTH,
      Role.ADVISOR,
      Role.INSTRUCTOR,
    ],
    employeeId: "MULTI-ALL-001",
    email: "multi.all@nucare.local",
  },
];

async function upsertUser(spec, passwordHash) {
  const email = spec.email.toLowerCase();
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: email, mode: "insensitive" } },
        spec.studentId ? { studentId: spec.studentId } : undefined,
        spec.employeeId ? { employeeId: spec.employeeId } : undefined,
      ].filter(Boolean),
    },
    select: { id: true },
  });

  const data = {
    name: spec.name,
    role: spec.role,
    additionalRoles: spec.additionalRoles ?? [],
    studentId: spec.studentId ?? null,
    employeeId: spec.employeeId ?? null,
    email,
    studyYear: spec.studyYear ?? null,
    section: spec.section ?? null,
    password: passwordHash,
    isActive: true,
  };

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data });
    return existing.id;
  }

  const created = await prisma.user.create({ data });
  return created.id;
}

async function ensureAssignment(studentId, advisorId, instructorId) {
  const existingAdvisor = await prisma.studentAdvisorAssignment.findFirst({
    where: { studentId, advisorId, isActive: true },
  });
  if (!existingAdvisor) {
    await prisma.studentAdvisorAssignment.create({
      data: { studentId, advisorId, isActive: true },
    });
  }

  const existingInstructor = await prisma.studentInstructorAssignment.findFirst({
    where: { studentId, instructorId, isActive: true },
  });
  if (!existingInstructor) {
    await prisma.studentInstructorAssignment.create({
      data: { studentId, instructorId, isActive: true },
    });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const ids = {};

  for (const user of users) {
    const id = await upsertUser(user, passwordHash);
    ids[user.email] = id;
    console.log(`ok ${user.email}`);
  }

  await ensureAssignment(
    ids["student.test@nucare.local"],
    ids["advisor.test@nucare.local"],
    ids["instructor.test@nucare.local"],
  );

  console.log("seeded local test accounts");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
