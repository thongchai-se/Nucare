import assert from "node:assert/strict";
import test from "node:test";
import { SurveyWaveStatus } from "@prisma/client";
import { deriveAssignmentStatus } from "./survey-wave-lifecycle";

const now = new Date("2026-06-15T12:00:00.000Z");
const past = new Date("2026-06-01T00:00:00.000Z");
const future = new Date("2026-07-01T00:00:00.000Z");

test("completed เมื่อมี completedAt ไม่ว่าคลื่นจะเป็นสถานะใด", () => {
  for (const waveStatus of [
    SurveyWaveStatus.OPEN,
    SurveyWaveStatus.CLOSED,
    SurveyWaveStatus.CANCELLED,
  ]) {
    assert.equal(
      deriveAssignmentStatus({ completedAt: past, closesAt: past, waveStatus, now }),
      "completed"
    );
  }
});

test("pending เมื่อคลื่น OPEN ยังไม่ถึง closesAt", () => {
  assert.equal(
    deriveAssignmentStatus({
      completedAt: null,
      closesAt: future,
      waveStatus: SurveyWaveStatus.OPEN,
      now,
    }),
    "pending"
  );
});

test("pending เมื่อคลื่น OPEN และไม่มี closesAt", () => {
  assert.equal(
    deriveAssignmentStatus({
      completedAt: null,
      closesAt: null,
      waveStatus: SurveyWaveStatus.OPEN,
      now,
    }),
    "pending"
  );
});

test("pending เมื่อคลื่น SCHEDULED ยังไม่หมดเวลา", () => {
  assert.equal(
    deriveAssignmentStatus({
      completedAt: null,
      closesAt: future,
      waveStatus: SurveyWaveStatus.SCHEDULED,
      now,
    }),
    "pending"
  );
});

test("overdue เมื่อเลย closesAt และยังไม่ทำ", () => {
  assert.equal(
    deriveAssignmentStatus({
      completedAt: null,
      closesAt: past,
      waveStatus: SurveyWaveStatus.OPEN,
      now,
    }),
    "overdue"
  );
});

test("ขอบเวลา closesAt เท่ากับ now ยังเป็น pending", () => {
  assert.equal(
    deriveAssignmentStatus({
      completedAt: null,
      closesAt: now,
      waveStatus: SurveyWaveStatus.OPEN,
      now,
    }),
    "pending"
  );
});

test("overdue เมื่อคลื่น CLOSED หรือ CANCELLED แต่ยังไม่ทำ (แม้ไม่มี closesAt)", () => {
  assert.equal(
    deriveAssignmentStatus({
      completedAt: null,
      closesAt: null,
      waveStatus: SurveyWaveStatus.CLOSED,
      now,
    }),
    "overdue"
  );
  assert.equal(
    deriveAssignmentStatus({
      completedAt: null,
      closesAt: future,
      waveStatus: SurveyWaveStatus.CANCELLED,
      now,
    }),
    "overdue"
  );
});
