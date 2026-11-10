import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BehaviorSeverity, ConsultationRequestStatus, ReferralStatus } from "@prisma/client";
import {
  behaviorSeverityLabel,
  consultationHistoryStatusLabel,
  formatBehaviorHistoryOutcome,
  formatConsultationHistoryAction,
  formatConsultationHistoryOutcome,
  formatReferralHistoryOutcome,
  presentHistoryAdvisorNote,
  referralHistoryStatusLabel,
  stripSeedMarkers,
} from "./history-display";

describe("history-display", () => {
  it("HD-01 ตัด marker seed/demo", () => {
    assert.equal(
      stripSeedMarkers("[WALKTHROUGH] คะแนนตกลงชัด ดูเครียดเรื่องฝึกงาน"),
      "คะแนนตกลงชัด ดูเครียดเรื่องฝึกงาน"
    );
    assert.equal(
      stripSeedMarkers("[MH-DEMO] [WALKTHROUGH] ส่งต่อติดตามหลังคัดกรอง"),
      "ส่งต่อติดตามหลังคัดกรอง"
    );
    assert.equal(stripSeedMarkers("[DEMO] ในคาบเรียนดูเหม่อลอย"), "ในคาบเรียนดูเหม่อลอย");
    assert.equal(
      stripSeedMarkers("[MH-DEMO] [WALKTHROUGH] ส่งต่อเร่งด่วนจากที่ปรึกษา (peer) — นอนไม่หลับ"),
      "ส่งต่อเร่งด่วนจากที่ปรึกษา — นอนไม่หลับ"
    );
    assert.equal(stripSeedMarkers("[FULL-SEED] คำขอจากนิสิต"), "คำขอจากนิสิต");
  });

  it("HD-02 ป้ายสถานะ/ความเร่งด่วนเป็นภาษาไทย", () => {
    assert.equal(consultationHistoryStatusLabel(ConsultationRequestStatus.SCHEDULED), "นัดหมายแล้ว");
    assert.equal(consultationHistoryStatusLabel(ConsultationRequestStatus.CANCELLED), "ยกเลิก");
    assert.equal(referralHistoryStatusLabel(ReferralStatus.ACCEPTED), "กำลังดูแล");
    assert.equal(behaviorSeverityLabel(BehaviorSeverity.MEDIUM), "ปานกลาง");
    assert.equal(formatBehaviorHistoryOutcome("HIGH"), "ความเร่งด่วน: สูง");
    assert.equal(formatReferralHistoryOutcome("PENDING"), "สถานะ: รอผู้เชี่ยวชาญรับเคส");
  });

  it("HD-03 จัดรูปคำขอปรึกษาให้อ่านง่าย ไม่โชว์ ISO", () => {
    const action = formatConsultationHistoryAction({
      channelLabel: "พบตัว / ที่คณะ",
      note: "[WALKTHROUGH] นิสิตขอเปลี่ยนนัด — รออาจารย์ตอบ",
    });
    assert.match(action, /ช่องทาง: พบตัว/);
    assert.doesNotMatch(action, /WALKTHROUGH/);
    assert.match(action, /นิสิตขอเปลี่ยนนัด/);

    const when = new Date("2026-11-12T09:09:21.835Z");
    const outcome = formatConsultationHistoryOutcome({
      status: ConsultationRequestStatus.SCHEDULED,
      scheduledAt: when,
      advisorNote: null,
    });
    assert.match(outcome, /สถานะ: นัดหมายแล้ว/);
    assert.doesNotMatch(outcome, /T09:09:21/);
    assert.match(outcome, /นัดหมาย:/);

    assert.equal(
      presentHistoryAdvisorNote("ขอยกเลิก — ตารางเวลาไม่สะดวกในช่วงนี้"),
      "ตารางเวลาไม่สะดวกในช่วงนี้"
    );
  });
});
