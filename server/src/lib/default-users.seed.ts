import { Prisma, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

type SeedUser = {
  name: string;
  role: Role;
  studentId?: string;
  employeeId?: string;
  email: string;
};

const seedUsers: SeedUser[] = [
  {
    name: "System Admin",
    role: Role.ADMIN,
    employeeId: "ADM001",
    email: "admin@nucare.local",
  },
  {
    name: "Student Demo",
    role: Role.STUDENT,
    studentId: "660000000-1",
    email: "student@nucare.local",
  },
  {
    name: "Advisor Demo",
    role: Role.ADVISOR,
    employeeId: "ADV001",
    email: "advisor@nucare.local",
  },
  {
    name: "Mental Health Demo",
    role: Role.MENTAL_HEALTH,
    employeeId: "MHS001",
    email: "mentalhealth@nucare.local",
  },
  {
    name: "Instructor Demo",
    role: Role.INSTRUCTOR,
    employeeId: "INS001",
    email: "instructor@nucare.local",
  },
  {
    name: "Executive Demo",
    role: Role.EXECUTIVE,
    employeeId: "EXE001",
    email: "executive@nucare.local",
  },
];

const DEFAULT_PASSWORD = process.env.DEFAULT_SEED_PASSWORD || "Nucare@12345";

type SeedSummary = {
  createdCount: number;
  skippedCount: number;
  passwordSource: "DEFAULT_SEED_PASSWORD" | "fallback";
};

export const seedDefaultUsersIfMissing = async (
  prisma: PrismaClient
): Promise<SeedSummary> => {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  let createdCount = 0;

  for (const user of seedUsers) {
    const email = user.email.toLowerCase();
    const uniqueWhere: Prisma.UserWhereInput[] = [
      {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
    ];

    if (user.studentId) {
      uniqueWhere.push({ studentId: user.studentId });
    }

    if (user.employeeId) {
      uniqueWhere.push({ employeeId: user.employeeId });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: uniqueWhere },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    await prisma.user.create({
      data: {
        name: user.name,
        role: user.role,
        studentId: user.studentId,
        employeeId: user.employeeId,
        email,
        password: passwordHash,
        isActive: true,
      },
    });

    createdCount += 1;
  }

  return {
    createdCount,
    skippedCount: seedUsers.length - createdCount,
    passwordSource: process.env.DEFAULT_SEED_PASSWORD ? "DEFAULT_SEED_PASSWORD" : "fallback",
  };
};

export const getDefaultSeedAccounts = (): SeedUser[] => seedUsers;