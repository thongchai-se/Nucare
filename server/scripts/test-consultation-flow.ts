/**
 * เทสไหลงานคำขอปรึกษา + นัดหมาย (ที่ปรึกษา) และนัดสุขภาพจิต กับ API จริง
 * รัน: npx tsx scripts/test-consultation-flow.ts
 */
import "dotenv/config";
import { ConsultationRequestStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
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
  return { jar, user: result.json?.user as { id?: string; name?: string } | undefined };
}

async function main() {
  console.log(`API ${API}\n--- คำขอปรึกษา (นิสิต ↔ ที่ปรึกษา) ---`);

  const student = await login("student.test@nucare.local");
  const student2 = await login("student2.test@nucare.local");
  const advisor = await login("advisor.test@nucare.local");
  const peer = await login("advisor.peer@nucare.local");
  const mh = await login("mh.test@nucare.local");

  const teachers = await api(student.jar, "GET", "/api/student/consultation-teachers");
  const teacherList: Array<{ id?: string; name?: string; employeeId?: string }> =
    teachers.json?.teachers || teachers.json?.items || teachers.json?.data || [];
  assert(teachers.status === 200, "student list consultation teachers", `n=${teacherList.length} keys=${Object.keys(teachers.json || {}).join(",")}`);

  const advisorId = advisor.user?.id;
  assert(Boolean(advisorId), "advisor login returns user id");
  const inTeacherList = teacherList.some((item) => item.id === advisorId);
  assert(
    inTeacherList,
    "advisor.test appears in student teacher list",
    `assigned=${teacherList.filter((item) => (item as { isAssignedAdvisor?: boolean }).isAssignedAdvisor).map((item) => item.name).join(" | ") || "-"}`
  );
  // ใช้ id จาก login เท่านั้น — อย่า fallback ชื่อที่มีคำว่า "ที่ปรึกษา" เพราะจะไปโดนบัญชีอื่น
  const teacherId = advisorId as string;

  const badTopic = await api(student.jar, "POST", "/api/student/consultation-requests", {
    teacherId,
    topic: "หัวข้อปลอม",
    preferredChannel: "IN_PERSON",
  });
  assert(badTopic.status === 400, "create rejects invalid topic", `status=${badTopic.status}`);

  const badTeacher = await api(student.jar, "POST", "/api/student/consultation-requests", {
    teacherId: "not-a-teacher",
    topic: "สุขภาพใจและความเครียด",
    preferredChannel: "ONLINE",
  });
  assert(badTeacher.status === 404, "create rejects unknown teacher", `status=${badTeacher.status}`);

  const stamp = Date.now();
  const student3 = await login("student3.test@nucare.local");

  const studentIds = [student.user?.id, student2.user?.id, student3.user?.id].filter(
    (id): id is string => Boolean(id)
  );
  const closedPrep = await prisma.consultationRequest.updateMany({
    where: {
      studentId: { in: studentIds },
      status: {
        in: [
          ConsultationRequestStatus.PENDING,
          ConsultationRequestStatus.ACCEPTED,
          ConsultationRequestStatus.SCHEDULED,
        ],
      },
    },
    data: {
      status: ConsultationRequestStatus.CLOSED,
      closedAt: new Date(),
      advisorNote: `ปิดอัตโนมัติก่อนเทส ${stamp}`,
    },
  });
  assert(true, "preclose open consultations via db", `n=${closedPrep.count}`);

  // แยกนิสิตต่อเคส เพื่อไม่ชนกฎคำขอเปิดทีละรอบ + rate limit
  const badChannel = await api(student.jar, "POST", "/api/student/consultation-requests", {
    teacherId,
    topic: "สุขภาพใจและความเครียด",
    preferredChannel: "PHONE",
  });
  assert(badChannel.status === 400, "create rejects PHONE channel", `status=${badChannel.status}`);

  const createCases = [
    {
      label: "A-accept",
      jar: student.jar,
      topic: "การเรียนและผลการเรียน",
      preferredChannel: "IN_PERSON",
      note: `เทสรับคำขอ ${stamp}`,
    },
    {
      label: "B-schedule",
      jar: student2.jar,
      topic: "สุขภาพใจและความเครียด",
      preferredChannel: "ONLINE",
      note: `เทสนัดหมาย ${stamp}`,
    },
    {
      label: "C-close",
      jar: student3.jar,
      topic: "ทุนการศึกษาและค่าใช้จ่าย",
      preferredChannel: "IN_PERSON",
      note: `เทสปิดคำขอ ${stamp}`,
    },
  ] as const;

  const createdIds: Record<string, string> = {};
  const ownerJarByLabel: Record<string, CookieJar> = {};
  for (const item of createCases) {
    const created = await api(item.jar, "POST", "/api/student/consultation-requests", {
      teacherId,
      topic: item.topic,
      preferredChannel: item.preferredChannel,
      note: item.note,
    });
    assert(
      created.status === 201 || created.status === 200,
      `create ${item.label}`,
      `status=${created.status} msg=${created.json?.message || ""}`
    );
    const id = created.json?.request?.id || created.json?.id;
    assert(Boolean(id), `create ${item.label} returns id`);
    if (id) {
      createdIds[item.label] = id;
      ownerJarByLabel[item.label] = item.jar;
    }
  }

  const duplicate = await api(student.jar, "POST", "/api/student/consultation-requests", {
    teacherId,
    topic: "ความสัมพันธ์และครอบครัว",
    preferredChannel: "ONLINE",
    note: `เทสซ้ำขณะยังเปิด ${stamp}`,
  });
  assert(duplicate.status === 409, "block second open consultation request", `status=${duplicate.status}`);
  assert(
    duplicate.json?.code === "ACTIVE_CONSULTATION" || /คำขอ|นัด/.test(String(duplicate.json?.message || "")),
    "duplicate conflict message",
    `msg=${duplicate.json?.message || ""}`
  );

  for (const label of Object.keys(createdIds)) {
    const list = await api(ownerJarByLabel[label], "GET", "/api/student/consultation-requests");
    assert(list.status === 200, `${label} owner can list requests`, `n=${list.json?.requests?.length ?? 0}`);
    const found = (list.json?.requests || []).some((item: { id?: string }) => item.id === createdIds[label]);
    assert(found, `owner sees ${label}`);
  }

  const advisorList = await api(advisor.jar, "GET", "/api/advisor/consultation-requests");
  assert(advisorList.status === 200, "advisor list consultation requests", `n=${advisorList.json?.requests?.length ?? 0}`);
  for (const label of Object.keys(createdIds)) {
    const found = (advisorList.json?.requests || []).some((item: { id?: string }) => item.id === createdIds[label]);
    assert(found, `advisor sees ${label}`);
  }

  const peerList = await api(peer.jar, "GET", "/api/advisor/consultation-requests");
  assert(peerList.status === 200, "peer advisor list ok", `n=${peerList.json?.requests?.length ?? 0}`);
  const peerSeesA = (peerList.json?.requests || []).some((item: { id?: string }) => item.id === createdIds["A-accept"]);
  assert(!peerSeesA, "peer advisor does not see other advisor requests");

  const peerPatch = await api(peer.jar, "PATCH", `/api/advisor/consultation-requests/${createdIds["A-accept"]}`, {
    status: "ACCEPTED",
  });
  assert(peerPatch.status === 404, "peer cannot accept foreign request", `status=${peerPatch.status}`);

  const accept = await api(advisor.jar, "PATCH", `/api/advisor/consultation-requests/${createdIds["A-accept"]}`, {
    status: "ACCEPTED",
    advisorNote: "รับเรื่องแล้ว ติดต่อนิสิตภายในวันนี้",
  });
  assert(accept.status === 200, "advisor accept request A", `status=${accept.status}`);
  assert(accept.json?.request?.status === "ACCEPTED", "A status ACCEPTED", `got=${accept.json?.request?.status}`);

  const acceptB = await api(advisor.jar, "PATCH", `/api/advisor/consultation-requests/${createdIds["B-schedule"]}`, {
    status: "ACCEPTED",
  });
  assert(acceptB.status === 200, "advisor accept request B before offer", `status=${acceptB.status}`);

  const directSchedule = await api(
    advisor.jar,
    "PATCH",
    `/api/advisor/consultation-requests/${createdIds["B-schedule"]}`,
    {
      status: "SCHEDULED",
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      advisorNote: "พยายามตั้งนัดตรง",
    }
  );
  assert(directSchedule.status === 400, "direct PATCH SCHEDULED rejected", `status=${directSchedule.status}`);
  assert(
    directSchedule.json?.code === "USE_SCHEDULE_OFFER",
    "direct schedule returns USE_SCHEDULE_OFFER",
    `code=${directSchedule.json?.code || ""}`
  );

  const proposedAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const propose = await api(
    advisor.jar,
    "POST",
    `/api/advisor/consultation-requests/${createdIds["B-schedule"]}/schedule-offers`,
    {
      proposedAt,
      location: "Microsoft Teams — https://teams.example/meet/demo",
      note: "ลิงก์จากอาจารย์",
    }
  );
  assert(
    propose.status === 201 || propose.status === 200,
    "advisor propose schedule offer B",
    `status=${propose.status}`
  );
  const offerId = propose.json?.offer?.id as string | undefined;
  assert(Boolean(offerId), "B offer id returned");
  assert(
    propose.json?.offer?.waitingOn === "STUDENT",
    "B offer waitingOn STUDENT",
    `got=${propose.json?.offer?.waitingOn}`
  );

  const studentAcceptOffer = await api(
    student2.jar,
    "POST",
    `/api/student/consultation-requests/${createdIds["B-schedule"]}/schedule-offers/${offerId}/accept`
  );
  assert(studentAcceptOffer.status === 200, "student accept schedule offer B", `status=${studentAcceptOffer.status}`);
  assert(
    studentAcceptOffer.json?.request?.status === "SCHEDULED",
    "B status SCHEDULED after accept",
    `got=${studentAcceptOffer.json?.request?.status}`
  );
  assert(Boolean(studentAcceptOffer.json?.request?.scheduledAt), "B has scheduledAt");
  assert(
    Boolean(studentAcceptOffer.json?.request?.scheduleLocation),
    "B has scheduleLocation from advisor"
  );

  const close = await api(advisor.jar, "PATCH", `/api/advisor/consultation-requests/${createdIds["C-close"]}`, {
    status: "CLOSED",
    advisorNote: "นิสิตติดต่อช่องทางอื่นแล้ว ปิดคำขอ",
  });
  assert(close.status === 200, "advisor close request C", `status=${close.status}`);
  assert(close.json?.request?.status === "CLOSED", "C status CLOSED", `got=${close.json?.request?.status}`);

  const cancelA = await api(
    student.jar,
    "POST",
    `/api/student/consultation-requests/${createdIds["A-accept"]}/cancel`,
    { reason: "ตารางเวลาไม่สะดวกในช่วงนี้" }
  );
  assert(cancelA.status === 200, "student cancel accepted request A", `status=${cancelA.status}`);
  assert(cancelA.json?.request?.status === "CLOSED", "A closed after cancel", `got=${cancelA.json?.request?.status}`);
  assert(
    String(cancelA.json?.request?.advisorNote || "").includes("ปิดคิวกลางทาง"),
    "A mid-queue close note stored",
    `got=${cancelA.json?.request?.advisorNote}`
  );

  for (const [label, expected] of [
    ["A-accept", "CLOSED"],
    ["B-schedule", "SCHEDULED"],
    ["C-close", "CLOSED"],
  ] as const) {
    const jar = ownerJarByLabel[label];
    if (!jar || !createdIds[label]) {
      assert(false, `owner sees ${label} ${expected}`, "missing request id or cookie jar");
      continue;
    }
    const list = await api(jar, "GET", "/api/student/consultation-requests");
    const row = (list.json?.requests || []).find((item: { id?: string }) => item.id === createdIds[label]);
    assert(row?.status === expected, `owner sees ${label} ${expected}`, `got=${row?.status}`);
  }

  // ปิดเคสเทสที่ยังเปิด — ไม่ให้สะสมบน dashboard นิสิต
  const closedB = await api(advisor.jar, "PATCH", `/api/advisor/consultation-requests/${createdIds["B-schedule"]}`, {
    status: "CLOSED",
    advisorNote: `ปิดหลังเทส ${stamp}`,
  });
  assert(closedB.status === 200, "cleanup close B-schedule", `status=${closedB.status}`);

  console.log("\n--- นัดปรึกษาสุขภาพจิต ---");
  const studentUserId = student.user?.id;
  assert(Boolean(studentUserId), "student user id for referral");

  let referralId: string | undefined;
  const referral = await api(advisor.jar, "POST", `/api/advisor/students/${studentUserId}/referrals`, {
    target: "COUNSELING_CENTER",
    reason: `[TEST] เทสส่งต่อเพื่อสร้างนัดปรึกษา ${stamp}`,
    isUrgent: false,
  });
  if (referral.status === 200 || referral.status === 201) {
    referralId = referral.json?.referral?.id || referral.json?.id;
    assert(true, "advisor create counseling referral", `status=${referral.status}`);
  } else if (referral.status === 409) {
    const list = await api(advisor.jar, "GET", "/api/advisor/referrals");
    const open = (list.json?.referrals || []).find(
      (row: { studentId?: string; status?: string; id?: string }) =>
        row.studentId === studentUserId && (row.status === "PENDING" || row.status === "ACCEPTED")
    );
    referralId = open?.id;
    assert(Boolean(referralId), "reuse open counseling referral after 409", `id=${referralId || "-"}`);
  } else {
    assert(false, "advisor create counseling referral", `status=${referral.status} msg=${referral.json?.message || ""}`);
  }
  assert(Boolean(referralId), "referral id returned");

  if (referralId) {
    const acceptReferral = await api(mh.jar, "PATCH", `/api/mental-health/referrals/${referralId}/status`, {
      status: "ACCEPTED",
    });
    assert(
      acceptReferral.status === 200 || acceptReferral.status === 400,
      "mh accept referral (or already accepted)",
      `status=${acceptReferral.status}`
    );

    const createAppt = await api(mh.jar, "POST", "/api/mental-health/appointments", {
      studentId: studentUserId,
      referralId,
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      time: "14:30",
      location: "ห้องให้คำปรึกษา 1 (เทส)",
      note: `นัดเทส ${stamp}`,
    });
    assert(
      createAppt.status === 200 || createAppt.status === 201,
      "mh create appointment",
      `status=${createAppt.status} msg=${createAppt.json?.message || ""}`
    );
    const appointmentId = createAppt.json?.appointment?.id || createAppt.json?.id;
    assert(Boolean(appointmentId), "appointment id returned");

    const badAppt = await api(mh.jar, "POST", "/api/mental-health/appointments", {
      studentId: studentUserId,
      date: "22-10-2026",
      time: "2pm",
      location: "ห้องทดสอบ",
    });
    assert(badAppt.status === 400, "mh reject bad appointment datetime", `status=${badAppt.status}`);

    const noStudent = await api(mh.jar, "POST", "/api/mental-health/appointments", {
      studentId: "missing-student",
      date: "2026-12-01",
      time: "10:00",
      location: "ห้องทดสอบ",
    });
    assert(noStudent.status === 404, "mh reject missing student", `status=${noStudent.status}`);

    const closeReferral = await api(mh.jar, "PATCH", `/api/mental-health/referrals/${referralId}/status`, {
      status: "CLOSED",
    });
    assert(closeReferral.status === 200, "mh close test referral", `status=${closeReferral.status}`);
  }

  const dashboard = await api(mh.jar, "GET", "/api/mental-health/dashboard");
  assert(dashboard.status === 200, "mh dashboard loads after appointment", `status=${dashboard.status}`);

  console.log(`\nผลรวม: PASS ${passes.length} · FAIL ${failures.length}`);
  if (failures.length > 0) {
    console.error("เคสที่ล้ม:\n- " + failures.join("\n- "));
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
