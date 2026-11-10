/**
 * ทดสอบเคสจริง: สร้างส่งต่อ → roadmap PENDING → MH รับเคส → roadmap ACCEPTED
 * รัน: npx tsx scripts/test-referral-roadmap-flow.ts
 */
import "dotenv/config";

const BASE = process.env.API_BASE_URL || "http://localhost:5000";
const PASSWORD = "NucareTest!2026";

type Jar = Map<string, string>;

function parseSetCookie(header: string | null, jar: Jar) {
  if (!header) return;
  for (const part of header.split(/,(?=\s*[^;]+=[^;]+)/)) {
    const [pair] = part.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

async function api(jar: Jar, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (jar.size > 0) headers.cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = res.headers.getSetCookie?.() ?? [];
  if (raw.length > 0) {
    for (const c of raw) parseSetCookie(c, jar);
  } else {
    parseSetCookie(res.headers.get("set-cookie"), jar);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { status: res.status, data };
}

async function login(identifier: string) {
  const jar: Jar = new Map();
  const result = await api(jar, "POST", "/api/auth/login", { identifier, password: PASSWORD });
  if (result.status !== 200) {
    throw new Error(`login failed ${identifier}: ${result.status} ${JSON.stringify(result.data)}`);
  }
  return { jar, user: result.data.user };
}

function assert(cond: unknown, label: string, detail = "") {
  if (!cond) throw new Error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  console.log(`PASS ${label}`);
}

async function main() {
  const advisor = await login("advisor.test@nucare.local");
  const mh = await login("mh.test@nucare.local");

  const students = await api(advisor.jar, "GET", "/api/advisor/students");
  assert(students.status === 200, "list students");
  const student = students.data.students?.[0];
  assert(student?.id, "has advisee", JSON.stringify(students.data));

  const created = await api(advisor.jar, "POST", `/api/advisor/students/${student.id}/referrals`, {
    target: "COUNSELING_CENTER",
    reason: "[TEST] ทดสอบหมุดติดตามการส่งต่อ — เครียดเรียนและต้องการทีมสุขภาพจิตรับช่วง",
    isUrgent: false,
  });
  assert(created.status === 201 || created.status === 200, "create referral", `status=${created.status}`);
  const referralId = created.data.referral?.id;
  assert(referralId, "referral id returned");

  const pendingList = await api(advisor.jar, "GET", "/api/advisor/referrals");
  assert(pendingList.status === 200, "list referrals pending");
  const pending = pendingList.data.referrals?.find((r: any) => r.id === referralId);
  assert(pending, "created referral in list");
  if (!Array.isArray(pending.roadmap) || pending.roadmap.length < 1) {
    throw new Error(`FAIL PENDING has roadmap — keys=${Object.keys(pending).join(",")} body=${JSON.stringify(pending)}`);
  }
  assert(true, "PENDING has roadmap");
  assert(pending.roadmap[0].kind === "sent", "first pin is sent", JSON.stringify(pending.roadmap));
  console.log(
    "PENDING pins:",
    pending.roadmap.map((s: any) => `${s.kind}:${s.label}`).join(" → ")
  );

  const accepted = await api(mh.jar, "PATCH", `/api/mental-health/referrals/${referralId}/status`, {
    status: "ACCEPTED",
  });
  assert(accepted.status === 200, "MH accept referral", `status=${accepted.status}`);

  const afterList = await api(advisor.jar, "GET", "/api/advisor/referrals");
  const after = afterList.data.referrals?.find((r: any) => r.id === referralId);
  assert(after?.status === "ACCEPTED", "advisor sees ACCEPTED");
  const kinds = (after.roadmap ?? []).map((s: any) => s.kind);
  assert(kinds.includes("sent") && kinds.includes("accepted"), "ACCEPTED roadmap has sent+accepted", kinds.join(","));
  console.log(
    "ACCEPTED pins:",
    after.roadmap.map((s: any) => `${s.kind}:${s.label}${s.actorName ? `(${s.actorName})` : ""}`).join(" → ")
  );
  console.log(`owner=${after.currentOwnerName || "-"} careCount=${after.careSessionCount}`);

  const closed = await api(mh.jar, "PATCH", `/api/mental-health/referrals/${referralId}/status`, {
    status: "CLOSED",
  });
  assert(closed.status === 200, "MH close referral after roadmap check", `status=${closed.status}`);
  console.log("OK referral roadmap flow");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
