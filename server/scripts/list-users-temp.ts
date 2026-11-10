import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      name: true,
      email: true,
      studentId: true,
      employeeId: true,
      role: true,
      isActive: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  console.log(JSON.stringify(users, null, 2));
  console.log("count", users.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
