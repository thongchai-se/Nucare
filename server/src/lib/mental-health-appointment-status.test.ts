import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MentalHealthAppointmentStatus } from "@prisma/client";
import { canUpdateMentalHealthAppointmentStatus } from "./mental-health-appointment-status";

describe("mental-health appointment status", () => {
  it("MHA-S01 จาก SCHEDULED ไป COMPLETED / NO_SHOW / CANCELLED ได้", () => {
    assert.equal(
      canUpdateMentalHealthAppointmentStatus(
        MentalHealthAppointmentStatus.SCHEDULED,
        MentalHealthAppointmentStatus.COMPLETED
      ),
      true
    );
    assert.equal(
      canUpdateMentalHealthAppointmentStatus(
        MentalHealthAppointmentStatus.SCHEDULED,
        MentalHealthAppointmentStatus.NO_SHOW
      ),
      true
    );
    assert.equal(
      canUpdateMentalHealthAppointmentStatus(
        MentalHealthAppointmentStatus.SCHEDULED,
        MentalHealthAppointmentStatus.CANCELLED
      ),
      true
    );
  });

  it("MHA-S02 จากสถานะจบแล้วเปลี่ยนต่อไม่ได้", () => {
    assert.equal(
      canUpdateMentalHealthAppointmentStatus(
        MentalHealthAppointmentStatus.COMPLETED,
        MentalHealthAppointmentStatus.CANCELLED
      ),
      false
    );
    assert.equal(
      canUpdateMentalHealthAppointmentStatus(
        MentalHealthAppointmentStatus.CANCELLED,
        MentalHealthAppointmentStatus.SCHEDULED
      ),
      false
    );
  });
});
