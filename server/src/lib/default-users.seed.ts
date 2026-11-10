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

/** Admin จริงคนเดียวเมื่อเปิด ENABLE_DEFAULT_USER_SEED */
const seedUsers: SeedUser[] = [
  {
    name: "ผู้ดูแลระบบ ตัวอย่าง",
    role: Role.ADMIN,
    employeeId: "ADM-EX-001",
    email: "adminnucare@gmail.com",
  },
];

type SeedSummary = {
  enabled: boolean;
  createdCount: number;
  skippedCount: number;
};

const MINIMUM_SEED_PASSWORD_LENGTH = 8;

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

/** อ่านรหัส admin จาก env — ห้าม hardcode ในซอร์ส */
const getAdminSeedPassword = (): string => {
  const password = readEnv("ADMIN_SEED_PASSWORD") || readEnv("DEFAULT_SEED_PASSWORD");
  if (!password || password.length < MINIMUM_SEED_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_SEED_PASSWORD (หรือ DEFAULT_SEED_PASSWORD) must be set and at least ${MINIMUM_SEED_PASSWORD_LENGTH} characters long when ENABLE_DEFAULT_USER_SEED is enabled`
    );
  }

  return password;
};

/** สร้างผู้ใช้ตัวอย่างที่ยังไม่มี — ใช้เฉพาะเมื่อเปิด seed flags */
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

  const defaultPassword = getAdminSeedPassword();
  const passwordHash = await bcrypt.hash(defaultPassword, 12);
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
        mustChangePassword: false,
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
