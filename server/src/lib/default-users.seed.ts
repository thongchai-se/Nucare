import { Prisma, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readEnv } from "./env";

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

type SeedSummary = {
  enabled: boolean;
  createdCount: number;
  skippedCount: number;
};

const MINIMUM_SEED_PASSWORD_LENGTH = 12;

const parseBoolean = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

const shouldSeedDefaultUsers = (): boolean => {
  const explicitlyEnabled = parseBoolean(readEnv("ENABLE_DEFAULT_USER_SEED"));
  if (!explicitlyEnabled) {
    return false;
  }

  if (process.env.NODE_ENV === "production") {
    return parseBoolean(readEnv("ALLOW_DEFAULT_USER_SEED_IN_PRODUCTION"));
  }

  return true;
};

const getDefaultSeedPassword = (): string => {
  const password = readEnv("DEFAULT_SEED_PASSWORD");
  if (!password || password.length < MINIMUM_SEED_PASSWORD_LENGTH) {
    throw new Error(
      `DEFAULT_SEED_PASSWORD must be set and at least ${MINIMUM_SEED_PASSWORD_LENGTH} characters long when ENABLE_DEFAULT_USER_SEED is enabled`
    );
  }

  return password;
};

export const seedDefaultUsersIfMissing = async (
  prisma: PrismaClient
): Promise<SeedSummary> => {
  if (!shouldSeedDefaultUsers()) {
    return {
      enabled: false,
      createdCount: 0,
      skippedCount: seedUsers.length,
    };
  }

  const defaultPassword = getDefaultSeedPassword();
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
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
    enabled: true,
    createdCount,
    skippedCount: seedUsers.length - createdCount,
  };
};
