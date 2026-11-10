/**
 * เทสไหลงานข้อสังเกตแบบ integration กับ API จริง
 * รัน: npx tsx scripts/test-observation-flow.ts
 *
 * ผู้แจ้ง = multi.all-staff (นอกสังกัดนิสิตทดสอบ)
 * ผู้รับสัญญาณ = advisor.test (ที่ปรึกษาของนิสิต)
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
    if (eq > 0) {
      jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
};

const cookieHeader = (jar: CookieJar) =>
  [...jar.entries()].map(([key, value]) => `${key}=${value}`).join("; ");

async function api(
  jar: CookieJar,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; json: any }> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: cookieHeader(jar),
    },
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
  return { jar, user: result.json?.user };
}

async function main() {
  console.log(`API ${API}`);

  const reporter = await login("multi.all-staff@nucare.local");
  const advisor = await login("advisor.test@nucare.local");

  const advisorStudents = await api(advisor.jar, "GET", "/api/advisor/students");
  assert((advisorStudents.json?.students?.length ?? 0) > 0, "primary advisor has advisees");
  const ownAdvisee = (advisorStudents.json?.students || [])[0];
  assert(Boolean(ownAdvisee?.id), "picked own advisee for reject test");

  const ownReject = await api(advisor.jar, "POST", "/api/advisor/observation-records", {
    studentId: ownAdvisee.id,
    observedAt: new Date().toISOString().slice(0, 10),
    category: "ทดสอบ",
    details: "ไม่ควรแจ้งนิสิตในสังกัดตัวเองได้",
    severity: "LOW",
  });
  assert(
    ownReject.status === 400 && ownReject.json?.code === "OWN_ADVISEE_NOT_ALLOWED",
    "advisor cannot report own advisee",
    `status=${ownReject.status}; code=${ownReject.json?.code}`
  );

  const advisorSearch = await api(advisor.jar, "GET", "/api/advisor/observation-students?search=ภูมิ");
  const ownInSearch = (advisorSearch.json?.students || []).some(
    (item: { id?: string }) => item.id === ownAdvisee.id
  );
  assert(!ownInSearch, "own advisee excluded from observation search");

  const students = await api(reporter.jar, "GET", "/api/advisor/observation-students?search=ภูมิ");
  assert(students.status === 200, "outsider search students", `n=${students.json?.students?.length ?? 0}`);
  const target = (students.json?.students || []).find((item: { studentId?: string }) =>
    String(item.studentId || "").includes("681100001")
  );
  assert(Boolean(target), "found student 681100001-1 for create");

  const bad = await api(reporter.jar, "POST", "/api/advisor/observation-records", {
    studentId: "not-a-real-student",
    observedAt: new Date().toISOString().slice(0, 10),
    category: "ทดสอบ",
    details: "should 404",
    severity: "LOW",
  });
  assert(bad.status === 404, "create observation rejects unknown student", `status=${bad.status}`);

  const invalid = await api(reporter.jar, "POST", "/api/advisor/observation-records", {
    studentId: target?.id,
    observedAt: "not-a-date",
    category: "ทดสอบ",
    details: "วันที่ผิด",
    severity: "LOW",
  });
  assert(invalid.status === 400, "create observation rejects bad date", `status=${invalid.status}`);

  const created = await api(reporter.jar, "POST", "/api/advisor/observation-records", {
    studentId: target?.id,
    observedAt: new Date().toISOString().slice(0, 10),
    category: "เทสไหลงานอัตโนมัติ",
    details: "สร้างจาก test-observation-flow เพื่อตรวจรับเรื่อง/ปิดเรื่อง",
    severity: "HIGH",
  });
  assert(created.status === 201, "outsider creates observation", `status=${created.status}`);
  const recordId = created.json?.behaviorRecord?.id as string | undefined;
  assert(Boolean(recordId), "create returns behaviorRecord.id");

  const reporterHistory = await api(reporter.jar, "GET", "/api/advisor/observation-records");
  const reporterRow = (reporterHistory.json?.records || []).find((row: { id: string }) => row.id === recordId);
  assert(reporterHistory.status === 200, "reporter lists own observations");
  assert(
    reporterRow?.status === "PENDING",
    "new observation starts PENDING for reporter",
    `status=${reporterRow?.status}`
  );
  assert(
    Array.isArray(reporterRow?.advisorRecipients) && reporterRow.advisorRecipients.length > 0,
    "reporter sees advisor recipients",
    `recipients=${reporterRow?.advisorRecipients?.join(",")}`
  );

  const alerts = await api(advisor.jar, "GET", "/api/alerts/me");
  const openAlert = (alerts.json?.alerts || []).find(
    (alert: { sourceId?: string; status?: string; type?: string }) =>
      alert.sourceId === recordId && alert.status === "OPEN" && alert.type === "BEHAVIOR_REPORTED"
  );
  assert(Boolean(openAlert), "advisee advisor receives OPEN BEHAVIOR_REPORTED in signals");

  if (openAlert) {
    const ack = await api(advisor.jar, "PATCH", `/api/alerts/${openAlert.id}/acknowledge`);
    assert(ack.status === 200, "advisor acknowledges alert", `status=${ack.status}`);

    const afterAck = await api(reporter.jar, "GET", "/api/advisor/observation-records");
    const ackRow = (afterAck.json?.records || []).find((row: { id: string }) => row.id === recordId);
    assert(
      ackRow?.status === "ACKNOWLEDGED",
      "reporter sees ACKNOWLEDGED after advisor ack",
      `status=${ackRow?.status}`
    );

    const relatedAlerts = ((await api(advisor.jar, "GET", "/api/alerts/me")).json?.alerts || []).filter(
      (alert: { sourceId?: string; type?: string }) =>
        alert.sourceId === recordId && alert.type === "BEHAVIOR_REPORTED"
    );
    for (const alert of relatedAlerts) {
      const close = await api(advisor.jar, "PATCH", `/api/alerts/${alert.id}/close`);
      assert(
        close.status === 200 || close.status === 404,
        `close related alert ${alert.id}`,
        `status=${close.status}`
      );
    }

    const afterPartialClose = await api(reporter.jar, "GET", "/api/advisor/observation-records");
    const partialRow = (afterPartialClose.json?.records || []).find((row: { id: string }) => row.id === recordId);
    const recipientCount = Array.isArray(partialRow?.advisorRecipients)
      ? partialRow.advisorRecipients.length
      : 0;
    if (recipientCount > 1) {
      assert(
        partialRow?.status === "ACKNOWLEDGED",
        "with multiple advisors, one close must stay ACKNOWLEDGED until all close",
        `status=${partialRow?.status}; recipients=${recipientCount}`
      );
    } else {
      assert(
        partialRow?.status === "COMPLETED",
        "with a single advisor recipient, close completes the case",
        `status=${partialRow?.status}`
      );
    }
  }

  const foreignClose = await api(reporter.jar, "PATCH", `/api/alerts/${openAlert?.id || "x"}/close`);
  assert(
    foreignClose.status === 404 || !openAlert,
    "non-recipient cannot close advisor alert",
    `status=${foreignClose.status}`
  );

  console.log("");
  console.log(`Passed ${passes.length}, failed ${failures.length}`);
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
