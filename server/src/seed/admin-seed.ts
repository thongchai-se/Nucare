import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { applyFileBackedEnvironmentVariables } from "../lib/env";

const MINIMUM_SEED_PASSWORD_LENGTH = 8;

const ADMIN_EMAIL = "adminnucare@gmail.com";
const ADMIN_NAME = "ผู้ดูแลระบบ ตัวอย่าง";
const ADMIN_EMPLOYEE_ID = "ADM-EX-001";

type SeedResult = {
  email: string;
  created: boolean;
  passwordUpdated: boolean;
};

const parseBoolean = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
};

/** โหลด *_FILE (เช่น DATABASE_URL_FILE, ADMIN_SEED_PASSWORD_FILE) โดยไม่ log ค่า secret */
const bootstrapSeedEnvironment = (): void => {
  applyFileBackedEnvironmentVariables(process.env);
};

const readAdminSeedPassword = (): string => {
  const password =
    process.env.ADMIN_SEED_PASSWORD?.trim() || process.env.DEFAULT_SEED_PASSWORD?.trim();
  if (!password || password.length < MINIMUM_SEED_PASSWORD_LENGTH) {
    throw new Error(
      "ADMIN_SEED_PASSWORD (หรือ DEFAULT_SEED_PASSWORD / *_FILE) must be set and at least 8 characters"
    );
  }
  return password;
};

const readDatabaseUrl = (): string => {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL (หรือ DATABASE_URL_FILE) must be set for admin seed");
  }
  return databaseUrl;
};

/**
 * สร้างหรือซ่อมบัญชี Admin คนเดียวสำหรับ production
 * - สร้างใหม่ถ้ายังไม่มี
 * - ถ้ามีแล้วไม่เปลี่ยนรหัสผ่าน เว้นแต่ FORCE_ADMIN_SEED_PASSWORD=true
 */
export const runAdminSeed = async (): Promise<SeedResult> => {
  bootstrapSeedEnvironment();
  readDatabaseUrl();

  const forcePasswordReset = parseBoolean(process.env.FORCE_ADMIN_SEED_PASSWORD);
  const prisma = new PrismaClient();

  try {
    const email = ADMIN_EMAIL.toLowerCase();
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { employeeId: ADMIN_EMPLOYEE_ID }],
      },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (existing) {
      const data: {
        name: string;
        role: Role;
        employeeId: string;
        email: string;
        isActive: boolean;
        mustChangePassword: boolean;
        password?: string;
      } = {
        name: ADMIN_NAME,
        role: Role.ADMIN,
        employeeId: ADMIN_EMPLOYEE_ID,
        email,
        isActive: true,
        mustChangePassword: false,
      };

      let passwordUpdated = false;
      if (forcePasswordReset) {
        data.password = await bcrypt.hash(readAdminSeedPassword(), 12);
        passwordUpdated = true;
      }

      await prisma.user.update({
        where: { id: existing.id },
        data,
      });

      console.log("[seed] Admin account already exists — profile/role ensured");
      if (passwordUpdated) {
        console.log("[seed] Admin password was reset because FORCE_ADMIN_SEED_PASSWORD=true");
      } else {
        console.log(
          "[seed] Admin password left unchanged (set FORCE_ADMIN_SEED_PASSWORD=true to reset)"
        );
      }

      return { email, created: false, passwordUpdated };
    }

    const passwordHash = await bcrypt.hash(readAdminSeedPassword(), 12);
    await prisma.user.create({
      data: {
        name: ADMIN_NAME,
        role: Role.ADMIN,
        employeeId: ADMIN_EMPLOYEE_ID,
        email,
        password: passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
    });

    console.log(`[seed] Created ADMIN ${email} (${ADMIN_NAME})`);
    console.log("[seed] Password was read from ADMIN_SEED_PASSWORD / *_FILE and was not printed");

    return { email, created: true, passwordUpdated: true };
  } finally {
    await prisma.$disconnect();
  }
};

const isDirectRun = (() => {
  const entry = process.argv[1]?.replace(/\\/g, "/");
  if (!entry) {
    return false;
  }
  return entry.endsWith("/seed/admin-seed.js") || entry.endsWith("/seed/admin-seed.ts");
})();

if (isDirectRun) {
  runAdminSeed()
    .then((result) => {
      console.log(
        `[seed] Done created=${result.created} passwordUpdated=${result.passwordUpdated}`
      );
    })
    .catch((error) => {
      console.error("[seed] Failed to seed admin", error);
      process.exitCode = 1;
    });
}
