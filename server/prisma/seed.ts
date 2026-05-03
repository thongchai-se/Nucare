import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const MINIMUM_SEED_PASSWORD_LENGTH = 8;

const getDefaultSeedPassword = (): string => {
  const password = process.env.DEFAULT_SEED_PASSWORD?.trim();
  if (!password || password.length < MINIMUM_SEED_PASSWORD_LENGTH) {
    throw new Error(
      `DEFAULT_SEED_PASSWORD must be set and at least ${MINIMUM_SEED_PASSWORD_LENGTH} characters long`
    );
  }

  return password;
};

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
];

const createOrUpdateUser = async (
  user: SeedUser,
  getPasswordHash: () => Promise<string>,
): Promise<{ email: string; created: boolean }> => {
  const existing = await prisma.user.findUnique({
    where: { email: user.email.toLowerCase() },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: user.name,
        role: user.role,
        studentId: user.studentId,
        employeeId: user.employeeId,
        isActive: true,
      },
    });

    return { email: user.email, created: false };
  }

  const passwordHash = await getPasswordHash();

  await prisma.user.create({
    data: {
      name: user.name,
      role: user.role,
      studentId: user.studentId,
      employeeId: user.employeeId,
      email: user.email.toLowerCase(),
      password: passwordHash,
      isActive: true,
    },
  });

  return { email: user.email, created: true };
};

async function main() {
  let resolvedSeedPassword: string | null = null;
  let passwordHashPromise: Promise<string> | null = null;

  const getPasswordHash = async (): Promise<string> => {
    if (!passwordHashPromise) {
      resolvedSeedPassword = getDefaultSeedPassword();
      passwordHashPromise = bcrypt.hash(resolvedSeedPassword, 10);
    }

    return passwordHashPromise;
  };

  const results = await Promise.all(seedUsers.map((user) => createOrUpdateUser(user, getPasswordHash)));

  const createdCount = results.filter((item) => item.created).length;
  const updatedCount = results.length - createdCount;

  console.log("[seed] Completed default user seeding");
  console.log(`[seed] Created: ${createdCount}, Updated: ${updatedCount}`);
  console.log("[seed] Login accounts:");
  for (const account of seedUsers) {
    console.log(`- ${account.role}: ${account.email}`);
  }
  if (createdCount > 0 && resolvedSeedPassword) {
    console.log(`[seed] Password for newly created accounts: ${resolvedSeedPassword}`);
  }
}

main()
  .catch((error) => {
    console.error("[seed] Failed to seed users", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
