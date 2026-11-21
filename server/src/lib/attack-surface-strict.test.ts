import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AssessmentInstrument,
  BehaviorSeverity,
  ConsultationRequestStatus,
  MentalHealthAppointmentStatus,
  ReferralStatus,
  ReferralTarget,
} from "@prisma/client";
import {
  createCareRecordSchema,
  createObservationSchema,
  createReferralSchema,
  updateConsultationRequestStatusSchema,
} from "../controllers/advisor.controller";
import { consentSchema, CONSENT_POLICY_VERSION } from "../controllers/consent.controller";
import {
  updateAppointmentStatusSchema,
  updateReferralStatusSchema,
} from "../controllers/mental-health.controller";
import {
  createConsultationRequestSchema,
  submitAssessmentSchema,
} from "../controllers/student.controller";

/** ตรวจว่าสคีมายูนิทปฏิเสธคีย์แปลก — กัน mass assignment หลังเทสโจมตี */
function assertRejectsUnknownKey(
  schema: { safeParse: (v: unknown) => { success: boolean } },
  valid: Record<string, unknown>,
  attackKey = "role"
) {
  const ok = schema.safeParse(valid);
  assert.equal(ok.success, true, "baseline payload ต้องผ่าน");
  const attacked = schema.safeParse({ ...valid, [attackKey]: "ADMIN" });
  assert.equal(attacked.success, false, `ต้องปฏิเสธคีย์ ${attackKey}`);
}

describe("attack-surface strict body schemas", () => {
  it("AS-01 consent ปฏิเสธ userId / role ใน body", () => {
    assertRejectsUnknownKey(
      consentSchema,
      {
        anonymousId: "anon-id-12",
        status: "necessary_only",
        analytics: false,
        policyVersion: CONSENT_POLICY_VERSION,
      },
      "userId"
    );
  });

  it("AS-02 advisor care/referral/observation/consultation ปฏิเสธฟิลด์แปลก", () => {
    assertRejectsUnknownKey(createCareRecordSchema, {
      careDate: "2026-11-20",
      careType: "follow-up",
      topic: "topic text",
      action: "action text",
    });
    assertRejectsUnknownKey(createReferralSchema, {
      target: ReferralTarget.COUNSELING_CENTER,
      reason: "เครียดเรียน",
    });
    assertRejectsUnknownKey(createObservationSchema, {
      studentId: "stu1",
      observedAt: "2026-11-20T10:00:00.000Z",
      category: "behavior",
      details: "details here",
      severity: BehaviorSeverity.MEDIUM,
    });
    assertRejectsUnknownKey(updateConsultationRequestStatusSchema, {
      status: ConsultationRequestStatus.ACCEPTED,
    });
  });

  it("AS-03 mental-health status schemas ปฏิเสธฟิลด์แปลก", () => {
    assertRejectsUnknownKey(updateReferralStatusSchema, {
      status: ReferralStatus.ACCEPTED,
    });
    assertRejectsUnknownKey(updateAppointmentStatusSchema, {
      status: MentalHealthAppointmentStatus.COMPLETED,
    });
  });

  it("AS-04 student assessment / consultation request ปฏิเสธฟิลด์แปลก", () => {
    assertRejectsUnknownKey(submitAssessmentSchema, {
      instrument: AssessmentInstrument.Q9,
      answers: [
        {
          questionCode: "Q1",
          questionText: "question",
          answerValue: "1",
        },
      ],
    });
    assertRejectsUnknownKey(createConsultationRequestSchema, {
      teacherId: "teacher1",
      topic: "การเรียนและผลการเรียน",
    });
  });
});
