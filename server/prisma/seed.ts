/**
 * Entry สำหรับ `prisma db seed` ตอนพัฒนา (ต้องมี tsx)
 * Production ใช้: `npm run prisma:seed` → node dist/seed/admin-seed.js
 */
import { runAdminSeed } from "../src/seed/admin-seed.js";

runAdminSeed()
  .then((result) => {
    console.log(`[seed] Done created=${result.created} passwordUpdated=${result.passwordUpdated}`);
  })
  .catch((error) => {
    console.error("[seed] Failed to seed admin", error);
    process.exitCode = 1;
  });
