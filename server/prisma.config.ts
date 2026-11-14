import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    // Local/dev: tsx. Production image: ใช้ `npm run prisma:seed` (node dist/...)
    seed: "tsx src/seed/admin-seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    directUrl: env("DIRECT_URL"),
  },
});
