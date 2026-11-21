/**
 * ยิง privilege probe + login ผิด แล้วตรวจ AuditLog
 * รัน: npx tsx scripts/verify-security-red-flags.ts
 */
const BASE = process.env.ATTACK_BASE_URL || "http://127.0.0.1:5000";
const PASS = "NucareTest!2026";

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const loginOk = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      Accept: "application/json",
    },
    body: JSON.stringify({
      identifier: "student1.example@nucare.local",
      password: PASS,
    }),
  });
  const setCookie = (loginOk.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() || [];
  const cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  console.log("student login", loginOk.status, Boolean(cookie));

  await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      Accept: "application/json",
    },
    body: JSON.stringify({
      identifier: "student1.example@nucare.local",
      password: "WrongPassword!999",
    }),
  });

  const probe = await fetch(`${BASE}/api/admin/users`, {
    headers: { Cookie: cookie, Accept: "application/json" },
  });
  console.log("privilege probe status", probe.status);

  await new Promise((r) => setTimeout(r, 500));

  const since = new Date(Date.now() - 10 * 60 * 1000);
  const logs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: since },
      action: { in: ["security.privilege-probe", "auth.login.failed", "security.rate-limit"] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { action: true, description: true, createdAt: true },
  });
  console.log(JSON.stringify(logs, null, 2));
  await prisma.$disconnect();

  const actions = new Set(logs.map((l) => l.action));
  if (!actions.has("security.privilege-probe") || !actions.has("auth.login.failed")) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
