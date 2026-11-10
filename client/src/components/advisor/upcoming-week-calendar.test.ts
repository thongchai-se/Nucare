import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildUpcomingWeekCalendar,
  buildWeekTimelineModel,
  formatHourMinuteLabel,
  getAppointmentStartMinutes,
  getTimelineEventStyle,
  scheduledAtToLocalDateKey,
  toLocalDateKey,
  type UpcomingCalendarAppointment,
} from "./upcoming-week-calendar";

function appt(
  partial: Partial<UpcomingCalendarAppointment> & Pick<UpcomingCalendarAppointment, "id" | "scheduledAt">
): UpcomingCalendarAppointment {
  return {
    studentName: partial.studentName ?? "นิสิต",
    scheduledAtLabel: partial.scheduledAtLabel ?? "label",
    topic: partial.topic ?? "ปรึกษา",
    location: partial.location ?? "ออนไลน์",
    ...partial,
  };
}

describe("upcoming week calendar", () => {
  it("UWC-01 สร้างคีย์วันที่ท้องถิ่นและกันค่าเสีย", () => {
    const local = new Date(2026, 10, 10, 15, 30, 0);
    assert.equal(toLocalDateKey(local), "2026-11-10");
    assert.equal(scheduledAtToLocalDateKey("not-a-date"), null);
  });

  it("UWC-02 จัดกลุ่มนัดตามวันในขอบเขต 7 วัน", () => {
    const now = new Date(2026, 10, 10, 9, 0, 0);
    const days = buildUpcomingWeekCalendar(
      [
        appt({ id: "a", scheduledAt: new Date(2026, 10, 10, 14, 0, 0).toISOString(), studentName: "เอ" }),
        appt({ id: "b", scheduledAt: new Date(2026, 10, 12, 10, 0, 0).toISOString(), studentName: "บี" }),
        appt({ id: "c", scheduledAt: new Date(2026, 10, 12, 16, 0, 0).toISOString(), studentName: "ซี" }),
        appt({ id: "skip", scheduledAt: new Date(2026, 10, 20, 10, 0, 0).toISOString() }),
      ],
      now,
      7
    );

    assert.equal(days.length, 7);
    assert.equal(days[0]?.dateKey, "2026-11-10");
    assert.equal(days[0]?.isToday, true);
    assert.equal(days[0]?.appointments.length, 1);
    assert.equal(days[0]?.appointments[0]?.id, "a");
    assert.equal(days[2]?.dateKey, "2026-11-12");
    assert.equal(days[2]?.appointments.map((item) => item.id).join(","), "b,c");
    assert.equal(
      days.every((day) => day.dateKey !== "2026-11-20" || day.appointments.length === 0),
      true
    );
  });

  it("UWC-03 วันว่างยังถูกสร้าง และ dayCount อย่างน้อย 1", () => {
    const now = new Date(2026, 0, 1, 8, 0, 0);
    const empty = buildUpcomingWeekCalendar([], now, 3);
    assert.equal(empty.length, 3);
    assert.ok(empty.every((day) => day.appointments.length === 0));

    const single = buildUpcomingWeekCalendar([], now, 0);
    assert.equal(single.length, 1);
  });

  it("UWC-04 สร้างโมเดล week timeline วางนัดตามชั่วโมง", () => {
    const now = new Date(2026, 10, 10, 9, 0, 0);
    const model = buildWeekTimelineModel(
      [
        appt({ id: "a", scheduledAt: new Date(2026, 10, 10, 13, 0, 0).toISOString() }),
        appt({ id: "b", scheduledAt: new Date(2026, 10, 11, 10, 30, 0).toISOString() }),
      ],
      now,
      7
    );
    assert.equal(model.events.length, 2);
    assert.equal(model.events[0]?.dayIndex, 0);
    assert.equal(model.events[0]?.timeLabel, "13:00");
    assert.equal(model.events[1]?.dayIndex, 1);
    assert.equal(getAppointmentStartMinutes("bad"), null);
    assert.equal(formatHourMinuteLabel(130), "02:10");
    const style = getTimelineEventStyle(
      { startMinutes: 13 * 60, durationMinutes: 60 },
      model.startHour,
      model.hourHeightPx
    );
    assert.ok(style.top >= 0);
    assert.ok(style.height > 0);
  });
});
