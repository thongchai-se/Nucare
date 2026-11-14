import "./env";
import { PrismaClient } from "@prisma/client";
import { normalizeDatabaseUrl } from "./database-url";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  neonKeepAlive: NodeJS.Timeout | undefined;
};

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
const databaseUrl = rawDatabaseUrl ? normalizeDatabaseUrl(rawDatabaseUrl) : undefined;

/** สร้าง Prisma client โดยบังคับ URL ที่ normalize แล้ว (เช่น Neon direct สำหรับ Express) */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
    ...(databaseUrl
      ? {
          datasources: {
            db: { url: databaseUrl },
          },
        }
      : {}),
  });

/** ping เป็นระยะเพื่อลด Error Closed จาก Neon ที่ตัด idle TCP */
function startNeonKeepAlive(client: PrismaClient): void {
  if (globalForPrisma.neonKeepAlive || process.env.VERCEL) {
    return;
  }
  if (!databaseUrl || !/\.neon\.tech/i.test(databaseUrl)) {
    return;
  }

  const intervalMs = Number(process.env.DB_KEEPALIVE_INTERVAL_MS || 120_000);
  if (!Number.isFinite(intervalMs) || intervalMs < 30_000) {
    return;
  }

  globalForPrisma.neonKeepAlive = setInterval(() => {
    void client.$queryRaw`SELECT 1`.catch(() => {
      // ปล่อยให้ Prisma reconnect เองในคำขอถัดไป
    });
  }, intervalMs);

  globalForPrisma.neonKeepAlive.unref?.();
}

startNeonKeepAlive(prisma);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
