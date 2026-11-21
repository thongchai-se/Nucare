/**
 * เทสโจมตีแบบมีเป้าหมายต่อ API ในเครื่อง (authorized defensive audit)
 * รัน: npx tsx scripts/security-attack-probe.ts
 */
const BASE = process.env.ATTACK_BASE_URL || "http://127.0.0.1:5000";
const PASS = "NucareTest!2026";

type Finding = {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO" | "PASS";
  title: string;
  detail: string;
};

const findings: Finding[] = [];

const record = (f: Finding) => {
  findings.push(f);
  const mark =
    f.severity === "PASS"
      ? "PASS"
      : f.severity === "INFO"
        ? "INFO"
        : `FAIL:${f.severity}`;
  console.log(`[${mark}] ${f.id} ${f.title}`);
  if (f.detail) console.log(`         ${f.detail.slice(0, 240)}`);
};

const parseSetCookie = (headers: Headers): string => {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const list =
    typeof anyHeaders.getSetCookie === "function"
      ? anyHeaders.getSetCookie()
      : (() => {
          const single = headers.get("set-cookie");
          return single ? [single] : [];
        })();
  return list
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
};

const mergeCookies = (existing: string, setCookieHeader: string): string => {
  const map = new Map<string, string>();
  for (const part of existing.split(";").map((s) => s.trim()).filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) map.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const part of setCookieHeader.split(";").map((s) => s.trim()).filter(Boolean)) {
    if (!part.includes("=")) continue;
    const i = part.indexOf("=");
    map.set(part.slice(0, i), part.slice(i + 1));
  }
  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
};

async function req(
  method: string,
  path: string,
  opts: {
    cookie?: string;
    body?: unknown;
    headers?: Record<string, string>;
    origin?: string;
  } = {}
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(opts.headers || {}),
  };
  if (opts.cookie) headers.Cookie = opts.cookie;
  if (opts.origin) headers.Origin = opts.origin;
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  const setCookie = parseSetCookie(res.headers);
  return {
    status: res.status,
    json,
    text,
    setCookie,
    headers: res.headers,
    cookie: setCookie
      ? mergeCookies(opts.cookie || "", setCookie)
      : opts.cookie || "",
  };
}

async function login(identifier: string) {
  const res = await req("POST", "/api/auth/login", {
    body: { identifier, password: PASS },
    origin: "http://localhost:3000",
  });
  return res;
}

async function main() {
  console.log(`Attack probe against ${BASE}\n`);

  const health = await req("GET", "/api/health");
  if (health.status !== 200) {
    console.error("API not reachable");
    process.exit(1);
  }

  // --- A1: unauthenticated access ---
  for (const path of [
    "/api/admin/users",
    "/api/advisor/students",
    "/api/student/dashboard",
    "/api/mental-health/dashboard",
    "/api/executive/overview",
    "/api/chat/sessions",
    "/api/auth/me",
  ]) {
    const r = await req("GET", path);
    if (r.status === 401 || r.status === 403) {
      record({
        id: "A1",
        severity: "PASS",
        title: `Unauth blocked ${path}`,
        detail: `status=${r.status}`,
      });
    } else {
      record({
        id: "A1",
        severity: "CRITICAL",
        title: `Unauth access allowed ${path}`,
        detail: `status=${r.status} body=${r.text.slice(0, 120)}`,
      });
    }
  }

  // --- A2: path traversal site-media ---
  for (const name of [
    "..%2F..%2Fpackage.json",
    "../package.json",
    "..\\..\\package.json",
    "....//....//package.json",
  ]) {
    const r = await req("GET", `/api/uploads/site-media/${name}`);
    if (r.status === 400 || r.status === 404) {
      record({
        id: "A2",
        severity: "PASS",
        title: `Path traversal blocked (${name})`,
        detail: `status=${r.status}`,
      });
    } else if (r.status === 200 && /name|dependencies|prisma/i.test(r.text)) {
      record({
        id: "A2",
        severity: "CRITICAL",
        title: `Path traversal leaked file (${name})`,
        detail: r.text.slice(0, 120),
      });
    } else {
      record({
        id: "A2",
        severity: "MEDIUM",
        title: `Unexpected traversal response (${name})`,
        detail: `status=${r.status}`,
      });
    }
  }

  // --- A3: CSRF evil Origin on login ---
  {
    const r = await req("POST", "/api/auth/login", {
      body: { identifier: "student1.example@nucare.local", password: PASS },
      origin: "https://evil.example",
    });
    if (r.status === 403) {
      record({
        id: "A3",
        severity: "PASS",
        title: "Evil Origin rejected on login",
        detail: `status=${r.status}`,
      });
    } else if (r.status === 200) {
      record({
        id: "A3",
        severity: "HIGH",
        title: "Evil Origin accepted on login (CSRF/cookie set from attacker site)",
        detail: `status=${r.status} cookies=${r.setCookie.slice(0, 80)}`,
      });
    } else {
      record({
        id: "A3",
        severity: "INFO",
        title: "Evil Origin login response",
        detail: `status=${r.status} ${r.text.slice(0, 100)}`,
      });
    }
  }

  // --- A4: mass assignment on login ---
  {
    const r = await req("POST", "/api/auth/login", {
      body: {
        identifier: "student1.example@nucare.local",
        password: PASS,
        role: "ADMIN",
        roles: ["ADMIN"],
        isActive: true,
      },
      origin: "http://localhost:3000",
    });
    if (r.status === 400 || r.status === 401) {
      record({
        id: "A4",
        severity: "PASS",
        title: "Login rejects unknown fields (.strict)",
        detail: `status=${r.status}`,
      });
    } else if (r.status === 200) {
      record({
        id: "A4",
        severity: "MEDIUM",
        title: "Login accepts extra fields (mass assignment surface)",
        detail: "strict schema not applied or ignored",
      });
    }
  }

  // --- Login actors ---
  const student1 = await login("student1.example@nucare.local");
  const advisor1 = await login("advisor1.example@nucare.local");
  const advisor2 = await login("advisor2.example@nucare.local");
  const mh1 = await login("mh1.example@nucare.local");
  const sd1 = await login("sd1.example@nucare.local");

  if (student1.status !== 200 || !student1.cookie) {
    record({
      id: "SETUP",
      severity: "CRITICAL",
      title: "Cannot login student1 — abort role tests",
      detail: `${student1.status} ${student1.text.slice(0, 160)}`,
    });
    printSummary();
    process.exit(1);
  }

  // Cookie flags from login
  {
    const raw =
      typeof (student1.headers as Headers & { getSetCookie?: () => string[] })
        .getSetCookie === "function"
        ? (
            student1.headers as Headers & { getSetCookie: () => string[] }
          ).getSetCookie()
        : [student1.headers.get("set-cookie") || ""];
    const joined = raw.join(" | ");
    const hasHttpOnly = /httponly/i.test(joined);
    const hasSameSite = /samesite/i.test(joined);
    if (hasHttpOnly && hasSameSite) {
      record({
        id: "A5",
        severity: "PASS",
        title: "Auth cookies set HttpOnly + SameSite",
        detail: joined.slice(0, 200),
      });
    } else {
      record({
        id: "A5",
        severity: "HIGH",
        title: "Auth cookies missing HttpOnly/SameSite",
        detail: joined.slice(0, 200),
      });
    }
  }

  // --- A6: privilege escalation student -> admin ---
  {
    const r = await req("GET", "/api/admin/users", { cookie: student1.cookie });
    if (r.status === 403 || r.status === 401) {
      record({
        id: "A6",
        severity: "PASS",
        title: "Student blocked from admin users",
        detail: `status=${r.status}`,
      });
    } else {
      record({
        id: "A6",
        severity: "CRITICAL",
        title: "Student can list admin users",
        detail: `status=${r.status}`,
      });
    }
  }

  // --- A7: student -> MH dashboard ---
  {
    const r = await req("GET", "/api/mental-health/dashboard", {
      cookie: student1.cookie,
    });
    if (r.status === 403 || r.status === 401) {
      record({
        id: "A7",
        severity: "PASS",
        title: "Student blocked from MH dashboard",
        detail: `status=${r.status}`,
      });
    } else {
      record({
        id: "A7",
        severity: "CRITICAL",
        title: "Student can open MH dashboard",
        detail: `status=${r.status}`,
      });
    }
  }

  // Resolve student ids via advisor lists
  let adv1Students: Array<{ id: string }> = [];
  let adv2Students: Array<{ id: string }> = [];
  if (advisor1.status === 200) {
    const list = await req("GET", "/api/advisor/students", {
      cookie: advisor1.cookie,
    });
    const body = list.json as { students?: Array<{ id: string }> } | null;
    adv1Students = body?.students || [];
  }
  if (advisor2.status === 200) {
    const list = await req("GET", "/api/advisor/students", {
      cookie: advisor2.cookie,
    });
    const body = list.json as { students?: Array<{ id: string }> } | null;
    adv2Students = body?.students || [];
  }

  // --- A8: IDOR advisor1 reading advisor2 student history ---
  {
    const foreign = adv2Students.find(
      (s) => !adv1Students.some((a) => a.id === s.id)
    );
    if (!foreign) {
      record({
        id: "A8",
        severity: "INFO",
        title: "Skip IDOR advisor history — no exclusive advisor2 student",
        detail: `adv1=${adv1Students.length} adv2=${adv2Students.length}`,
      });
    } else {
      const r = await req(
        "GET",
        `/api/advisor/students/${foreign.id}/history`,
        { cookie: advisor1.cookie }
      );
      if (r.status === 403 || r.status === 404) {
        record({
          id: "A8",
          severity: "PASS",
          title: "Advisor IDOR history blocked",
          detail: `student=${foreign.id} status=${r.status}`,
        });
      } else if (r.status === 200) {
        record({
          id: "A8",
          severity: "CRITICAL",
          title: "Advisor IDOR history allowed",
          detail: `student=${foreign.id} leaked history`,
        });
      } else {
        record({
          id: "A8",
          severity: "MEDIUM",
          title: "Advisor IDOR unexpected status",
          detail: `status=${r.status} ${r.text.slice(0, 100)}`,
        });
      }
    }
  }

  // --- A9: IDOR create referral as advisor1 on foreign student ---
  {
    const foreign = adv2Students.find(
      (s) => !adv1Students.some((a) => a.id === s.id)
    );
    if (foreign && advisor1.status === 200) {
      const r = await req(
        "POST",
        `/api/advisor/students/${foreign.id}/referrals`,
        {
          cookie: advisor1.cookie,
          origin: "http://localhost:3000",
          body: {
            target: "COUNSELING_CENTER",
            reason: "ATTACK_PROBE_REASON_SHOULD_BE_DENIED_XXXX",
            isUrgent: false,
          },
        }
      );
      if (r.status === 403 || r.status === 404) {
        record({
          id: "A9",
          severity: "PASS",
          title: "Advisor IDOR referral create blocked",
          detail: `status=${r.status}`,
        });
      } else if (r.status === 200 || r.status === 201) {
        record({
          id: "A9",
          severity: "CRITICAL",
          title: "Advisor IDOR referral create succeeded",
          detail: r.text.slice(0, 160),
        });
      } else {
        record({
          id: "A9",
          severity: "INFO",
          title: "Advisor IDOR referral response",
          detail: `status=${r.status} ${r.text.slice(0, 120)}`,
        });
      }
    }
  }

  // --- A10: MH history without ownership ---
  if (mh1.status === 200 && adv1Students[0]) {
    const sid = adv1Students[0].id;
    const r = await req("GET", `/api/mental-health/students/${sid}/history`, {
      cookie: mh1.cookie,
    });
    if (r.status === 403 || r.status === 404) {
      record({
        id: "A10",
        severity: "PASS",
        title: "MH history denied without case ownership",
        detail: `status=${r.status}`,
      });
    } else if (r.status === 200) {
      const body = r.json as {
        history?: { careSessions?: unknown[]; summary?: string };
        careSessions?: unknown[];
      } | null;
      const text = r.text;
      const hasClinical =
        /"summary"|"plan"|"clinicalNotes"|careSessions/i.test(text) &&
        !/"careSessions":\s*\[\]/.test(text);
      if (hasClinical) {
        record({
          id: "A10",
          severity: "HIGH",
          title: "MH history returns clinical content without ownership",
          detail: text.slice(0, 160),
        });
      } else {
        record({
          id: "A10",
          severity: "MEDIUM",
          title: "MH history 200 without ownership (check payload)",
          detail: text.slice(0, 160),
        });
      }
    } else {
      record({
        id: "A10",
        severity: "INFO",
        title: "MH history probe",
        detail: `status=${r.status}`,
      });
    }
  }

  // --- A11: student IDOR chat session guess ---
  {
    const fakeId = "clxxxxxxxxxxxxxxxxxxxxxxxxx";
    const r = await req("GET", `/api/chat/sessions/${fakeId}/messages`, {
      cookie: student1.cookie,
    });
    if (r.status === 403 || r.status === 404 || r.status === 400) {
      record({
        id: "A11",
        severity: "PASS",
        title: "Chat session guess blocked",
        detail: `status=${r.status}`,
      });
    } else {
      record({
        id: "A11",
        severity: "HIGH",
        title: "Chat session guess unexpected",
        detail: `status=${r.status}`,
      });
    }
  }

  // --- A12: SQLi-ish search ---
  if (advisor1.status === 200) {
    const r = await req(
      "GET",
      `/api/advisor/students?search=${encodeURIComponent("%' OR 1=1 --")}`,
      { cookie: advisor1.cookie }
    );
    if (r.status === 200) {
      const body = r.json as { students?: unknown[] } | null;
      const count = body?.students?.length ?? -1;
      // Should still be scoped; empty or normal scoped list is OK
      if (count > adv1Students.length + 5) {
        record({
          id: "A12",
          severity: "HIGH",
          title: "Search may have expanded scope (SQLi-like)",
          detail: `count=${count} baseline=${adv1Students.length}`,
        });
      } else {
        record({
          id: "A12",
          severity: "PASS",
          title: "Advisor search stays scoped under injection payload",
          detail: `count=${count}`,
        });
      }
    } else {
      record({
        id: "A12",
        severity: "PASS",
        title: "Advisor search rejected injection payload",
        detail: `status=${r.status}`,
      });
    }
  }

  // --- A13: forgot-password removed (SSO-bound) ---
  {
    const r = await req("POST", "/api/auth/forgot-password", {
      body: { email: "student1.example@nucare.local" },
      origin: "http://localhost:3000",
    });
    if (r.status === 404) {
      record({
        id: "A13",
        severity: "PASS",
        title: "Forgot-password endpoint removed",
        detail: `status=${r.status}`,
      });
    } else {
      record({
        id: "A13",
        severity: "MEDIUM",
        title: "Forgot-password still reachable",
        detail: `status=${r.status}`,
      });
    }
  }

  // --- A14: error stack leak ---
  {
    const r = await req("POST", "/api/auth/login", {
      body: "not-json",
      origin: "http://localhost:3000",
      headers: { "Content-Type": "application/json" },
    });
    if (/stack|at Object\.|node_modules/i.test(r.text)) {
      record({
        id: "A14",
        severity: "MEDIUM",
        title: "Error response may leak stack",
        detail: r.text.slice(0, 160),
      });
    } else {
      record({
        id: "A14",
        severity: "PASS",
        title: "Malformed JSON does not leak stack",
        detail: `status=${r.status}`,
      });
    }
  }

  // --- A15: SD accepting referral without authz ---
  if (sd1.status === 200) {
    const r = await req("POST", "/api/student-development/referrals/fake-id/accept", {
      cookie: sd1.cookie,
      origin: "http://localhost:3000",
      body: {},
    });
    if (r.status === 403 || r.status === 404 || r.status === 400) {
      record({
        id: "A15",
        severity: "PASS",
        title: "SD fake referral accept blocked",
        detail: `status=${r.status}`,
      });
    } else {
      record({
        id: "A15",
        severity: "HIGH",
        title: "SD fake referral accept unexpected",
        detail: `status=${r.status} ${r.text.slice(0, 100)}`,
      });
    }
  }

  // --- A16: change-password removed (SSO-bound) ---
  {
    const r = await req("POST", "/api/auth/change-password", {
      cookie: student1.cookie,
      origin: "http://localhost:3000",
      body: {
        currentPassword: PASS,
        newPassword: PASS,
        confirmPassword: PASS,
        role: "ADMIN",
      },
    });
    if (r.status === 404) {
      record({
        id: "A16",
        severity: "PASS",
        title: "Change-password endpoint removed",
        detail: `status=${r.status}`,
      });
    } else {
      record({
        id: "A16",
        severity: "HIGH",
        title: "Change-password still reachable",
        detail: `status=${r.status} ${r.text.slice(0, 100)}`,
      });
    }
  }

  // --- A17: reset-password removed ---
  {
    const r = await req("POST", "/api/auth/reset-password", {
      body: { token: "x", password: "NucareTest!2026" },
      origin: "http://localhost:3000",
    });
    record({
      id: "A17",
      severity: r.status === 404 ? "PASS" : "MEDIUM",
      title: "Reset-password endpoint removed",
      detail: `status=${r.status}`,
    });
  }

  // --- A18: refresh without cookie ---
  {
    const r = await req("POST", "/api/auth/refresh", {
      origin: "http://localhost:3000",
    });
    if (r.status === 401) {
      record({
        id: "A18",
        severity: "PASS",
        title: "Refresh without cookie rejected",
        detail: `status=${r.status}`,
      });
    } else {
      record({
        id: "A18",
        severity: "HIGH",
        title: "Refresh without cookie unexpected",
        detail: `status=${r.status}`,
      });
    }
  }

  // --- A19: JWT none / forged access cookie ---
  {
    const header = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" })
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        userId: "attacker",
        role: "ADMIN",
        roles: ["ADMIN"],
      })
    ).toString("base64url");
    const forged = `${header}.${payload}.`;
    const r = await req("GET", "/api/admin/users", {
      cookie: `accessToken=${forged}`,
    });
    if (r.status === 401 || r.status === 403) {
      record({
        id: "A19",
        severity: "PASS",
        title: "JWT alg=none forged token rejected",
        detail: `status=${r.status}`,
      });
    } else {
      record({
        id: "A19",
        severity: "CRITICAL",
        title: "JWT alg=none accepted",
        detail: `status=${r.status}`,
      });
    }
  }

  // --- A20: student accessing executive ---
  {
    const r = await req("GET", "/api/executive/overview", {
      cookie: student1.cookie,
    });
    if (r.status === 403 || r.status === 401 || r.status === 404) {
      record({
        id: "A20",
        severity: "PASS",
        title: "Student blocked from executive",
        detail: `status=${r.status}`,
      });
    } else {
      record({
        id: "A20",
        severity: "CRITICAL",
        title: "Student can access executive",
        detail: `status=${r.status}`,
      });
    }
  }

  // --- A21: red-flag audits written for privilege probe + failed login ---
  {
    await req("POST", "/api/auth/login", {
      body: { identifier: "student1.example@nucare.local", password: "WrongPassword!999" },
      origin: "http://localhost:3000",
    });
    await req("GET", "/api/admin/users", { cookie: student1.cookie });

    // อ่าน AuditLog ตรงจาก DB — ไม่พึ่งรหัสแอดมินในเครื่องทดสอบ
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const since = new Date(Date.now() - 15 * 60 * 1000);
      const logs = await prisma.auditLog.findMany({
        where: {
          createdAt: { gte: since },
          action: {
            in: ["security.privilege-probe", "auth.login.failed"],
          },
        },
        select: { action: true },
        take: 50,
      });
      const actions = new Set(logs.map((log) => log.action));
      const hasPrivilege = actions.has("security.privilege-probe");
      const hasFailedLogin = actions.has("auth.login.failed");
      if (hasPrivilege && hasFailedLogin) {
        record({
          id: "A21",
          severity: "PASS",
          title: "Red-flag audits present (privilege-probe + login.failed)",
          detail: `privilege=${hasPrivilege} failedLogin=${hasFailedLogin}`,
        });
      } else {
        record({
          id: "A21",
          severity: "HIGH",
          title: "Missing expected security red-flag audits",
          detail: `privilege=${hasPrivilege} failedLogin=${hasFailedLogin}`,
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  }

  printSummary();
}

function printSummary() {
  const fails = findings.filter(
    (f) => !["PASS", "INFO"].includes(f.severity)
  );
  const passes = findings.filter((f) => f.severity === "PASS");
  console.log("\n========== SUMMARY ==========");
  console.log(`PASS=${passes.length} FAIL=${fails.length} INFO=${findings.filter((f) => f.severity === "INFO").length}`);
  if (fails.length) {
    console.log("\nFindings to fix:");
    for (const f of fails) {
      console.log(`- [${f.severity}] ${f.id} ${f.title}`);
      console.log(`  ${f.detail}`);
    }
  } else {
    console.log("No exploitable findings from this probe set.");
  }

  // machine-readable for later
  const fs = require("node:fs") as typeof import("node:fs");
  const out = "scripts/security-attack-probe-result.json";
  fs.writeFileSync(
    out,
    JSON.stringify({ at: new Date().toISOString(), findings }, null, 2)
  );
  console.log(`\nWrote ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
