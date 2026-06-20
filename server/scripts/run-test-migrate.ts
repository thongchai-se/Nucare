import { execSync } from "child_process";
import path from "path";
import "./load-test-env";

const serverRoot = path.join(__dirname, "..");

execSync("npx prisma migrate deploy", {
  cwd: serverRoot,
  stdio: "inherit",
  env: process.env,
});
