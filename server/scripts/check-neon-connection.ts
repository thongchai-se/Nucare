import "../src/lib/env";
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl, toNeonDirectDatabaseUrl } from "../src/lib/database-url";

const mask = (url: string) => url.replace(/:\/\/([^@]+)@/, "://***:***@");

async function main() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL is not set");
  }

  const runtimeUrl = normalizeDatabaseUrl(raw);
  const directUrl = process.env.DIRECT_URL?.trim() || toNeonDirectDatabaseUrl(raw);

  console.log("raw     ", mask(raw));
  console.log("runtime ", mask(runtimeUrl));
  console.log("direct  ", mask(directUrl));

  const prisma = new PrismaClient({
    datasources: { db: { url: runtimeUrl } },
    log: ["warn", "error"],
  });

  try {
    const rows = await prisma.$queryRaw<Array<{ ok: number; db: string }>>`
      SELECT 1::int AS ok, current_database() AS db
    `;
    console.log("query1  ", rows);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const rows2 = await prisma.$queryRaw<Array<{ ok: number }>>`
      SELECT 2::int AS ok
    `;
    console.log("query2  ", rows2);
    console.log("OK Neon/Prisma connection looks healthy");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
