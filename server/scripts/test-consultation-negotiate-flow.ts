/**
 * เทสเจรจานัดปรึกษาสองฝ่าย (เสนอ → ขอเปลี่ยน → ยอมรับ) ส่งหา advisor.test
 * รัน: npx tsx scripts/test-consultation-negotiate-flow.ts
 */
import "dotenv/config";

const API = process.env.NUCARE_API_BASE_URL?.trim() || "http://localhost:5000";
const PASSWORD = "NucareTest!2026";

type CookieJar = Map<string, string>;
const failures: string[] = [];
const passes: string[] = [];

const assert = (ok: boolean, label: string, detail = "") => {
  if (ok) {
    passes.push(label);
    console.log(`PASS  ${label}${detail ? ` — ${detail}` : ""}`);
    return;
  }
  failures.push(label);
  console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
};

const parseSetCookie = (headers: Headers, jar: CookieJar) => {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof anyHeaders.getSetCookie === "function" ? anyHeaders.getSetCookie() : [];
  for (const raw of cookies) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
};

const cookieHeader = (jar: CookieJar) =>
  [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");

async function api(jar: CookieJar, method: string, path: string, body?: unknown) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  parseSetCookie(response.headers, jar);
  let json: any = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  return { status: response.status, json };
}

async function login(identifier: string) {
  const jar: CookieJar = new Map();
  const result = await api(jar, "POST", "/api/auth/login", { identifier, password: PASSWORD });
  assert(result.status === 200, `login ${identifier}`, `status=${result.status}`);
  return { jar, user: result.json?.user as { id?: string; name?: string } | undefined };
}

async function main() {
  console.log(`API ${API}\n--- เจรจานัด (นิสิต ↔ สุภาวดี) ---`);
  const student = await login("student3.test@nucare.local");
  const advisor = await login("advisor.test@nucare.local");
  const teacherId = advisor.user?.id as string;
  assert(Boolean(teacherId), "advisor id");

  const stamp = Date.now();

  const preList = await api(student.jar, "GET", "/api/student/consultation-requests");
  for (const row of preList.json?.requests || []) {
    if (row?.id && (row.status === "PENDING" || row.status === "ACCEPTED" || row.status === "SCHEDULED")) {
      await api(advisor.jar, "PATCH", `/api/advisor/consultation-requests/${row.id}`, {
        status: "CLOSED",
        advisorNote: `ปิดก่อนเทสเจรจา ${stamp}`,
      });
    }
  }

  const created = await api(student.jar, "POST", "/api/student/consultation-requests", {
    teacherId,
    topic: "การฝึกปฏิบัติ/ขึ้นวอร์ด",
    preferredChannel: "IN_PERSON",
    note: `[NEGOTIATE-TEST] ${stamp}`,
  });
  assert(created.status === 201, "create request", `status=${created.status} msg=${created.json?.message || ""}`);
  const requestId = created.json?.request?.id as string;
  assert(Boolean(requestId), "request id");

  const accept = await api(advisor.jar, "PATCH", `/api/advisor/consultation-requests/${requestId}`, {
    status: "ACCEPTED",
  });
  assert(accept.status === 200, "advisor accept", `status=${accept.status}`);

  const propose = await api(advisor.jar, "POST", `/api/advisor/consultation-requests/${requestId}/schedule-offers`, {
    proposedAt: new Date(Date.now() + 4 * 864e5).toISOString(),
    location: "ห้องที่ปรึกษา A",
    note: "ข้อเสนอจากอาจารย์",
  });
  assert(propose.status === 201, "advisor propose", `status=${propose.status} msg=${propose.json?.message || ""}`);
  assert(propose.json?.offer?.waitingOn === "STUDENT", "waitingOn STUDENT", `got=${propose.json?.offer?.waitingOn}`);

  const change = await api(student.jar, "POST", `/api/student/consultation-requests/${requestId}/schedule-offers`, {
    proposedAt: new Date(Date.now() + 6 * 864e5).toISOString(),
    location: "ออนไลน์ Teams",
    note: "นิสิตขอเปลี่ยน",
  });
  assert(change.status === 201, "student request change", `status=${change.status}`);
  assert(change.json?.offer?.waitingOn === "ADVISOR", "waitingOn ADVISOR", `got=${change.json?.offer?.waitingOn}`);
  const offerId = change.json?.offer?.id as string;
  assert(Boolean(offerId), "change offer id");

  const acceptOffer = await api(
    advisor.jar,
    "POST",
    `/api/advisor/consultation-requests/${requestId}/schedule-offers/${offerId}/accept`
  );
  assert(
    acceptOffer.status === 200,
    "advisor accept offer",
    `status=${acceptOffer.status} msg=${acceptOffer.json?.message || ""}`
  );

  const list = await api(advisor.jar, "GET", "/api/advisor/consultation-requests");
  const row = (list.json?.requests || []).find((item: { id?: string }) => item.id === requestId);
  assert(row?.status === "SCHEDULED", "becomes SCHEDULED", `got=${row?.status}`);
  assert(Boolean(row?.scheduledAt), "has scheduledAt");

  // ปิดรอบแรกก่อนสร้างรอบสอง — นิสิตมีคำขอเปิดได้ทีละรอบ
  const closeFirst = await api(advisor.jar, "PATCH", `/api/advisor/consultation-requests/${requestId}`, {
    status: "CLOSED",
    advisorNote: `ปิดหลังเจรจารอบแรก ${stamp}`,
  });
  assert(closeFirst.status === 200, "close first request before second", `status=${closeFirst.status}`);

  // ฝั่งนิสิตยอมรับข้อเสนออาจารย์ (เคสแยก)
  const created2 = await api(student.jar, "POST", "/api/student/consultation-requests", {
    teacherId,
    topic: "ทุนการศึกษาและค่าใช้จ่าย",
    preferredChannel: "ONLINE",
    note: `[NEGOTIATE-TEST-2] ${stamp}`,
  });
  const requestId2 = created2.json?.request?.id as string;
  assert(created2.status === 201 && Boolean(requestId2), "create second request", `status=${created2.status}`);
  await api(advisor.jar, "PATCH", `/api/advisor/consultation-requests/${requestId2}`, { status: "ACCEPTED" });
  const propose2 = await api(advisor.jar, "POST", `/api/advisor/consultation-requests/${requestId2}/schedule-offers`, {
    proposedAt: new Date(Date.now() + 5 * 864e5).toISOString(),
    location: "Zoom — https://zoom.example/j/demo",
    note: "รอนิสิตยอมรับ",
  });
  const offerId2 = propose2.json?.offer?.id as string;
  assert(propose2.status === 201 && Boolean(offerId2), "advisor propose #2");
  const studentAccept = await api(
    student.jar,
    "POST",
    `/api/student/consultation-requests/${requestId2}/schedule-offers/${offerId2}/accept`
  );
  assert(studentAccept.status === 200, "student accept advisor offer", `status=${studentAccept.status}`);
  const list2 = await api(advisor.jar, "GET", "/api/advisor/consultation-requests");
  const row2 = (list2.json?.requests || []).find((item: { id?: string }) => item.id === requestId2);
  assert(row2?.status === "SCHEDULED", "second becomes SCHEDULED", `got=${row2?.status}`);

  const closeSecond = await api(advisor.jar, "PATCH", `/api/advisor/consultation-requests/${requestId2}`, {
    status: "CLOSED",
    advisorNote: `ปิดหลังเทสเจรจา ${stamp}`,
  });
  assert(closeSecond.status === 200, "cleanup close second request", `status=${closeSecond.status}`);

  console.log(`\nผลรวม: PASS ${passes.length} · FAIL ${failures.length}`);
  if (failures.length > 0) {
    console.error("เคสที่ล้ม:\n- " + failures.join("\n- "));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
