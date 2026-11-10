import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { contains: "nucare.local" } },
        { studentId: { startsWith: "68110000" } },
        { employeeId: { contains: "TEST" } },
        { employeeId: { contains: "MULTI" } },
      ],
    },
    select: {
      name: true,
      email: true,
      studentId: true,
      employeeId: true,
      role: true,
      isActive: true,
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });

  for (const user of users) {
    console.log(
      [user.role, user.email, user.studentId || user.employeeId || "-", user.name, user.isActive].join(" | ")
    );
  }
  console.log("n=" + users.length);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
