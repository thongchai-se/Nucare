import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { presentHistoryText, stripSeedMarkers } from "./history-display";

describe("client history-display", () => {
  it("ตัด marker และแปลสถานะ/ความเร่งด่วนเป็นไทย", () => {
    assert.equal(stripSeedMarkers("[WALKTHROUGH] เครียดฝึกงาน"), "เครียดฝึกงาน");
    assert.equal(
      stripSeedMarkers("[MH-DEMO] [WALKTHROUGH] ส่งต่อเร่งด่วนจากที่ปรึกษา (peer) — นอนไม่หลับ"),
      "ส่งต่อเร่งด่วนจากที่ปรึกษา — นอนไม่หลับ"
    );
    assert.equal(stripSeedMarkers("[FULL-SEED] คำขอจากนิสิต"), "คำขอจากนิสิต");
    assert.equal(
      presentHistoryText("สถานะ: SCHEDULED\nนัดหมาย: 2026-11-12T09:09:21.835Z", (iso) =>
        iso.startsWith("2026-11-12") ? "12 พ.ย. 2569 16:09" : iso
      ),
      "สถานะ: นัดหมายแล้ว\nนัดหมาย: 12 พ.ย. 2569 16:09"
    );
    assert.equal(
      presentHistoryText("ระดับความเร่งด่วน: MEDIUM", () => ""),
      "ความเร่งด่วน: ปานกลาง"
    );
    assert.equal(
      presentHistoryText("หมายเหตุ: ขอยกเลิก — ตารางเวลาไม่สะดวกในช่วงนี้", () => ""),
      "หมายเหตุ: ตารางเวลาไม่สะดวกในช่วงนี้"
    );
  });
});
