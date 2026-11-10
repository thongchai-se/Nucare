import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildScheduledAt,
  serializeMentalHealthAppointment,
  splitScheduledAt,
} from "./mental-health-appointments";

describe("mental-health appointments helpers", () => {
  it("MHA-01 buildScheduledAt accepts valid date and time", () => {
    const scheduledAt = buildScheduledAt("2026-10-22", "14:30");
    assert.ok(scheduledAt);
    assert.equal(scheduledAt.getFullYear(), 2026);
    assert.equal(scheduledAt.getMonth(), 9);
    assert.equal(scheduledAt.getDate(), 22);
    assert.equal(scheduledAt.getHours(), 14);
    assert.equal(scheduledAt.getMinutes(), 30);
  });

  it("MHA-02 buildScheduledAt rejects invalid inputs", () => {
    assert.equal(buildScheduledAt("22-10-2026", "14:30"), null);
    assert.equal(buildScheduledAt("2026-10-22", "2pm"), null);
    assert.equal(buildScheduledAt("", "14:30"), null);
  });

  it("MHA-03 splitScheduledAt round-trips local parts", () => {
    const scheduledAt = buildScheduledAt("2026-10-22", "09:05");
    assert.ok(scheduledAt);
    assert.deepEqual(splitScheduledAt(scheduledAt), { date: "2026-10-22", time: "09:05" });
  });

  it("MHA-04 serializeMentalHealthAppointment maps student-safe DTO fields", () => {
    const scheduledAt = buildScheduledAt("2026-10-22", "10:00");
    assert.ok(scheduledAt);

    const dto = serializeMentalHealthAppointment({
      id: "apt-1",
      studentId: "stu-1",
      scheduledAt,
      location: "ห้องให้คำปรึกษา 2",
      note: "นำบัตรนิสิตมาด้วย",
      status: "SCHEDULED",
      referralId: "ref-1",
      student: { name: "นิสิต ทดสอบ" },
      mentalHealthUser: { name: "นักจิตวิทยา ก" },
    });

    assert.equal(dto.id, "apt-1");
    assert.equal(dto.studentName, "นิสิต ทดสอบ");
    assert.equal(dto.date, "2026-10-22");
    assert.equal(dto.time, "10:00");
    assert.equal(dto.location, "ห้องให้คำปรึกษา 2");
    assert.equal(dto.note, "นำบัตรนิสิตมาด้วย");
    assert.equal(dto.providerName, "นักจิตวิทยา ก");
  });
});
