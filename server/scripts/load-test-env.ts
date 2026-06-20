import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const testEnvPath = path.join(__dirname, "../.env.test");

if (!fs.existsSync(testEnvPath)) {
  throw new Error(
    `Missing ${testEnvPath}. Copy .env.test.example to .env.test before running SQA tests.`
  );
}

dotenv.config({ path: testEnvPath, override: true });

export const assertTestDatabaseUrl = (): void => {
  const databaseUrl = process.env.DATABASE_URL?.trim() || "";
  if (!databaseUrl.includes("5433") && process.env.SQA_ALLOW_NON_TEST_DB !== "1") {
    throw new Error(
      "Refusing to run SQA against non-test database. DATABASE_URL must use port 5433 or set SQA_ALLOW_NON_TEST_DB=1."
    );
  }
};
