import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isAssessmentReminderAlert,
  pickStudentAssessmentReminderPopup,
  resolveAssessmentReminderPopup,
  type StudentHomeAlertDto,
} from "./student-home-alerts";

const sample = (
  id: string,
  overrides: Partial<StudentHomeAlertDto> = {}
): StudentHomeAlertDto => ({
  id,
  title: `t-${id}`,
  message: `m-${id}`,
  status: "OPEN",
  type: "ADVISOR_FOLLOW_UP",
  sourceType: null,
  createdAt: "2026-11-20T10:00:00.000Z",
  ...overrides,
});

describe("student home alerts", () => {
  it("SHA-01 จำแนก reminder แบบประเมินจาก sourceType หรือข้อความ", () => {
    assert.equal(
      isAssessmentReminderAlert(
        sample("1", { sourceType: "StudentDevelopmentReminder" })
      ),
      true
    );
    assert.equal(
      isAssessmentReminderAlert(sample("2", { sourceType: "SurveyWave" })),
      true
    );
    assert.equal(
      isAssessmentReminderAlert(sample("3", { title: "โปรดทำแบบประเมินสุขภาพจิต" })),
      true
    );
    assert.equal(isAssessmentReminderAlert(sample("4", { title: "นัดคุย" })), false);
  });

  it("SHA-02 เลือกเตือนแบบประเมิน OPEN ล่าสุด", () => {
    const picked = pickStudentAssessmentReminderPopup([
      sample("old", {
        sourceType: "StudentDevelopmentReminder",
        createdAt: "2026-11-20T09:00:00.000Z",
      }),
      sample("closed", {
        status: "CLOSED",
        sourceType: "StudentDevelopmentReminder",
        createdAt: "2026-11-20T12:00:00.000Z",
      }),
      sample("other", { title: "นัดคุย", createdAt: "2026-11-20T13:00:00.000Z" }),
      sample("new", {
        sourceType: "StudentDevelopmentReminder",
        createdAt: "2026-11-20T11:00:00.000Z",
      }),
    ]);
    assert.equal(picked?.id, "new");
  });

  it("SHA-03 ไม่มีเตือนแบบประเมินแล้วคืน null", () => {
    assert.equal(
      pickStudentAssessmentReminderPopup([sample("a", { title: "นัดคุย" })]),
      null
    );
  });

  it("SHA-04 ทำครบแล้วไม่โชว์ป๊อปอัป และต้อง acknowledge Alert ค้าง", () => {
    const resolved = resolveAssessmentReminderPopup({
      pendingSurveys: [],
      alerts: [
        sample("r1", { sourceType: "StudentDevelopmentReminder" }),
        sample("r2", { sourceType: "SurveyWave" }),
      ],
    });
    assert.equal(resolved.show, false);
    assert.equal(resolved.alertsToAcknowledge.length, 2);
  });

  it("SHA-05 มีค้างทำ + มีแจ้งเตือน → โชว์รายการหลายแบบ", () => {
    const resolved = resolveAssessmentReminderPopup({
      pendingSurveys: [
        { id: "s1", title: "GHQ-28", waveLabel: "รอบ 1" },
        { id: "s2", title: "แบบประเมินเสริม", waveLabel: "รอบ A" },
      ],
      alerts: [sample("r1", { sourceType: "SurveyWave" })],
    });
    assert.equal(resolved.show, true);
    assert.equal(resolved.pendingSurveys.length, 2);
    assert.equal(resolved.alertsToAcknowledge.length, 0);
  });

  it("SHA-06 มีค้างทำแต่ไม่มีแจ้งเตือน → ไม่โชว์ป๊อปอัป", () => {
    const resolved = resolveAssessmentReminderPopup({
      pendingSurveys: [{ id: "s1", title: "GHQ-28" }],
      alerts: [sample("other", { title: "นัดคุย" })],
    });
    assert.equal(resolved.show, false);
    assert.equal(resolved.alertsToAcknowledge.length, 0);
  });
});
