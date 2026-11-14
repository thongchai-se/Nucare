import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWaveDuplicateKeys,
  buildWaveIdempotencyKey,
  collectExistingWaveKeys,
  isAutoSchedulable,
  planNextAutoWave,
} from "./survey-auto-schedule";

const SURVEY_ID = "survey-1";
const weekly = { frequency: "WEEKLY", scheduleEvery: null, scheduleUnit: null } as const;
const custom3Days = { frequency: "CUSTOM_INTERVAL", scheduleEvery: 3, scheduleUnit: "DAYS" } as const;

const base = (overrides: Partial<Parameters<typeof planNextAutoWave>[0]> = {}) => ({
  surveyId: SURVEY_ID,
  config: weekly as Parameters<typeof planNextAutoWave>[0]["config"],
  now: new Date(2026, 0, 12, 12, 0, 0),
  lastOpensAt: null as Date | null,
  surveyStartsAt: null as Date | null,
  hasPendingFutureWave: false,
  existingKeys: new Set<string>(),
  ...overrides,
});

test("buildWaveIdempotencyKey: คีย์เหมือนเดิมเมื่อข้อมูลเดียวกัน (deterministic)", () => {
  const opensAt = new Date("2026-01-05T03:00:00.000Z");
  const a = buildWaveIdempotencyKey({ surveyId: SURVEY_ID, opensAt });
  const b = buildWaveIdempotencyKey({ surveyId: SURVEY_ID, opensAt: new Date(opensAt) });
  assert.equal(a, b);
});

test("buildWaveIdempotencyKey: ต่างแบบประเมินหรือต่างเวลาเปิด -> คีย์ต่างกัน", () => {
  const opensAt = new Date("2026-01-05T03:00:00.000Z");
  const other = new Date("2026-01-12T03:00:00.000Z");
  assert.notEqual(
    buildWaveIdempotencyKey({ surveyId: "a", opensAt }),
    buildWaveIdempotencyKey({ surveyId: "b", opensAt })
  );
  assert.notEqual(
    buildWaveIdempotencyKey({ surveyId: SURVEY_ID, opensAt }),
    buildWaveIdempotencyKey({ surveyId: SURVEY_ID, opensAt: other })
  );
});

test("buildWaveIdempotencyKey: termKey มีผลก่อน weekStart และ opensAt", () => {
  const key1 = buildWaveIdempotencyKey({
    surveyId: SURVEY_ID,
    opensAt: new Date("2026-01-05T03:00:00.000Z"),
    termKey: " เทอม-2569 ",
  });
  const key2 = buildWaveIdempotencyKey({
    surveyId: SURVEY_ID,
    opensAt: new Date("2026-06-01T03:00:00.000Z"),
    termKey: "เทอม-2569",
  });
  assert.equal(key1, key2);
});

test("buildWaveIdempotencyKey: weekStart เดียวกันถือว่าซ้ำแม้เวลาเปิดต่างกัน", () => {
  const weekStart = new Date("2026-01-05T00:00:00.000Z");
  const a = buildWaveIdempotencyKey({
    surveyId: SURVEY_ID,
    opensAt: new Date("2026-01-05T03:00:00.000Z"),
    weekStart,
  });
  const b = buildWaveIdempotencyKey({
    surveyId: SURVEY_ID,
    opensAt: new Date("2026-01-06T09:00:00.000Z"),
    weekStart,
  });
  assert.equal(a, b);
});

test("buildWaveDuplicateKeys: คืนคีย์หลักและคีย์ opensAt (ไม่ซ้ำกันเอง)", () => {
  const opensAt = new Date("2026-01-05T03:00:00.000Z");
  assert.equal(buildWaveDuplicateKeys({ surveyId: SURVEY_ID, opensAt }).length, 1);
  assert.equal(
    buildWaveDuplicateKeys({ surveyId: SURVEY_ID, opensAt, termKey: "เทอม-2569" }).length,
    2
  );
});

test("collectExistingWaveKeys: รวมคีย์จากคลื่นที่มีอยู่", () => {
  const opensAt = new Date("2026-01-05T03:00:00.000Z");
  const keys = collectExistingWaveKeys([
    { surveyId: SURVEY_ID, opensAt, termKey: null, weekStart: null },
  ]);
  assert.ok(keys.has(buildWaveIdempotencyKey({ surveyId: SURVEY_ID, opensAt })));
});

test("isAutoSchedulable: ONE_SHOT, ACADEMIC_TERM และ CUSTOM ไม่ครบ ไม่สร้างอัตโนมัติ", () => {
  assert.equal(isAutoSchedulable({ frequency: "ONE_SHOT", scheduleEvery: null, scheduleUnit: null }), false);
  assert.equal(
    isAutoSchedulable({ frequency: "ACADEMIC_TERM", scheduleEvery: null, scheduleUnit: null }),
    false
  );
  assert.equal(
    isAutoSchedulable({ frequency: "CUSTOM_INTERVAL", scheduleEvery: null, scheduleUnit: null }),
    false
  );
  assert.equal(isAutoSchedulable(weekly), true);
  assert.equal(isAutoSchedulable(custom3Days), true);
});

test("planNextAutoWave: ONE_SHOT ถูกข้าม", () => {
  const plan = planNextAutoWave(
    base({ config: { frequency: "ONE_SHOT", scheduleEvery: null, scheduleUnit: null } })
  );
  assert.deepEqual(plan, { action: "skip", reason: "one_shot" });
});

test("planNextAutoWave: ไม่มีคลื่นและไม่มี startsAt -> no_anchor", () => {
  assert.deepEqual(planNextAutoWave(base()), { action: "skip", reason: "no_anchor" });
});

test("planNextAutoWave: ไม่มีคลื่นแต่ startsAt ผ่านมาแล้ว -> สร้าง OPEN ที่ startsAt", () => {
  const startsAt = new Date(2026, 0, 10, 8, 0, 0);
  const plan = planNextAutoWave(base({ surveyStartsAt: startsAt }));
  assert.equal(plan.action, "create");
  if (plan.action === "create") {
    assert.equal(plan.status, "OPEN");
    assert.equal(plan.draft.opensAt.getTime(), startsAt.getTime());
  }
});

test("planNextAutoWave: startsAt อยู่อนาคต -> SCHEDULED", () => {
  const startsAt = new Date(2026, 0, 20, 8, 0, 0);
  const plan = planNextAutoWave(base({ surveyStartsAt: startsAt }));
  assert.equal(plan.action, "create");
  if (plan.action === "create") {
    assert.equal(plan.status, "SCHEDULED");
  }
});

test("planNextAutoWave: รอบถัดไปยังไม่ถึงเวลา -> สร้างล่วงหน้าเป็น SCHEDULED ที่ last + 7 วัน", () => {
  const last = new Date(2026, 0, 10, 8, 0, 0);
  const plan = planNextAutoWave(base({ lastOpensAt: last }));
  assert.equal(plan.action, "create");
  if (plan.action === "create") {
    assert.equal(plan.status, "SCHEDULED");
    assert.equal(plan.draft.opensAt.getTime(), new Date(2026, 0, 17, 8, 0, 0).getTime());
  }
});

test("planNextAutoWave: ถึงเวลาแล้ว -> OPEN และ opensAt ไม่ขึ้นกับเวลา tick (idempotent)", () => {
  const last = new Date(2026, 0, 1, 8, 0, 0);
  const now1 = new Date(2026, 0, 9, 8, 5, 0);
  const now2 = new Date(2026, 0, 9, 9, 45, 0);
  const plan1 = planNextAutoWave(base({ lastOpensAt: last, now: now1 }));
  const plan2 = planNextAutoWave(base({ lastOpensAt: last, now: now2 }));
  assert.equal(plan1.action, "create");
  assert.equal(plan2.action, "create");
  if (plan1.action === "create" && plan2.action === "create") {
    assert.equal(plan1.status, "OPEN");
    assert.equal(plan1.draft.opensAt.getTime(), new Date(2026, 0, 8, 8, 0, 0).getTime());
    assert.equal(plan1.draft.opensAt.getTime(), plan2.draft.opensAt.getTime());
    assert.equal(
      buildWaveIdempotencyKey({ surveyId: SURVEY_ID, ...plan1.draft }),
      buildWaveIdempotencyKey({ surveyId: SURVEY_ID, ...plan2.draft })
    );
  }
});

test("planNextAutoWave: เรียกซ้ำหลังสร้างแล้ว (คลื่นล่าสุด = รอบที่สร้าง) ไม่สร้างรอบเดิมซ้ำ", () => {
  const last = new Date(2026, 0, 1, 8, 0, 0);
  const now = new Date(2026, 0, 9, 8, 5, 0);
  const first = planNextAutoWave(base({ lastOpensAt: last, now }));
  assert.equal(first.action, "create");
  if (first.action !== "create") {
    return;
  }
  const second = planNextAutoWave(base({ lastOpensAt: first.draft.opensAt, now }));
  assert.equal(second.action, "create");
  if (second.action === "create") {
    // รอบถัดไปคือรอบอนาคต ไม่ใช่รอบเดิม
    assert.equal(second.status, "SCHEDULED");
    assert.ok(second.draft.opensAt.getTime() > first.draft.opensAt.getTime());
  }
  const third = planNextAutoWave(
    base({ lastOpensAt: first.draft.opensAt, now, hasPendingFutureWave: true })
  );
  assert.deepEqual(third, { action: "skip", reason: "pending_scheduled_wave" });
});

test("planNextAutoWave: คีย์ซ้ำกับคลื่นที่มีอยู่ -> duplicate_wave", () => {
  const last = new Date(2026, 0, 1, 8, 0, 0);
  const now = new Date(2026, 0, 9, 8, 5, 0);
  const opensAt = new Date(2026, 0, 8, 8, 0, 0);
  const existingKeys = new Set([buildWaveIdempotencyKey({ surveyId: SURVEY_ID, opensAt })]);
  const plan = planNextAutoWave(base({ lastOpensAt: last, now, existingKeys }));
  // weekly ใช้ weekStart เป็นคีย์หลัก แต่คีย์ opensAt ต้องถูกตรวจด้วย
  assert.deepEqual(plan, { action: "skip", reason: "duplicate_wave" });
});

test("planNextAutoWave: ตามไม่ทันหลายรอบ -> กระโดดไปรอบล่าสุดที่ถึงเวลา ไม่ย้อนสร้างทุกรอบ", () => {
  const last = new Date(2026, 0, 1, 8, 0, 0);
  const now = new Date(2026, 0, 11, 12, 0, 0); // ผ่านไป 10 วัน ทุก 3 วัน (พลาดไปหลายรอบ)
  const plan = planNextAutoWave(base({ config: custom3Days, lastOpensAt: last, now }));
  assert.equal(plan.action, "create");
  if (plan.action === "create") {
    assert.equal(plan.status, "OPEN");
    // รอบที่เปิดได้ล่าสุด: 1 + 3*3 = 10 ม.ค.
    assert.equal(plan.draft.opensAt.getTime(), new Date(2026, 0, 10, 8, 0, 0).getTime());
  }
});

test("planNextAutoWave: เลยช่วงเปิดของรอบล่าสุดไปแล้ว -> window_passed", () => {
  // ทุก 3 วัน เปิด 2 วัน (interval-1); now = opens + 2.5 วัน
  const last = new Date(2026, 0, 1, 8, 0, 0);
  const now = new Date(2026, 0, 6, 20, 0, 0); // รอบ 4 ม.ค. 08:00 ปิด 6 ม.ค. 08:00 ผ่านแล้ว; รอบถัดไป 7 ม.ค.
  const plan = planNextAutoWave(base({ config: custom3Days, lastOpensAt: last, now }));
  assert.deepEqual(plan, { action: "skip", reason: "window_passed" });
});
