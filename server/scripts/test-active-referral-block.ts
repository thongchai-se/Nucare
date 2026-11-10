/**
 * ทดสอบกันส่งต่อซ้ำเมื่อมีเคส PENDING/ACCEPTED
 * รัน: npx tsx scripts/test-active-referral-block.ts
 */
import "dotenv/config";

const BASE = process.env.API_BASE_URL || "http://localhost:5000";
const PASSWORD = "NucareTest!2026";

type Jar = Map<string, string>;

async function api(jar: Jar, method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (jar.size > 0) headers.cookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const pair = c.split(";")[0];
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  return { status: res.status, data: await res.json() };
}

async function main() {
  const jar: Jar = new Map();
  const login = await api(jar, "POST", "/api/auth/login", {
    identifier: "advisor.test@nucare.local",
    password: PASSWORD,
  });
  if (login.status !== 200) throw new Error(`login ${login.status}`);

  const students = await api(jar, "GET", "/api/advisor/students");
  const student = students.data.students?.[0];
  if (!student?.id) throw new Error("no student");

  const first = await api(jar, "POST", `/api/advisor/students/${student.id}/referrals`, {
    target: "COUNSELING_CENTER",
    reason: "[TEST] เคสทดสอบกันส่งซ้ำ — ครั้งแรกควรผ่าน",
    isUrgent: false,
  });
  if (first.status !== 201 && first.status !== 409) {
    throw new Error(`first create unexpected ${first.status} ${JSON.stringify(first.data)}`);
  }
  const createdId = first.data?.referral?.id as string | undefined;
  if (first.status === 201) {
    console.log("PASS create first open referral");
  } else {
    console.log(`PASS student already has open referral (${first.data.message})`);
  }

  const dup = await api(jar, "POST", `/api/advisor/students/${student.id}/referrals`, {
    target: "COUNSELING_CENTER",
    reason: "[TEST] ครั้งนี้ต้องโดนบล็อก",
    isUrgent: false,
  });

  if (dup.status !== 409) {
    throw new Error(`expected 409 got ${dup.status} ${JSON.stringify(dup.data)}`);
  }
  console.log(`PASS block duplicate → 409: ${dup.data.message}`);

  if (createdId) {
    console.log(`NOTE created test referral ${createdId} — run cleanup-test-duplicate-referrals after suite`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
