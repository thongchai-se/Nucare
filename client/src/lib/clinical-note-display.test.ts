import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatMhCareNotePayload,
  formatSoapNotePayload,
  presentClinicalNote,
} from "./clinical-note-display";

describe("clinical-note-display", () => {
  it("แปลง S/O/A/P เป็นหัวข้อไทย และเก็บใหม่เป็นไทย", () => {
    assert.equal(
      presentClinicalNote("S: เครียดสอบ\nO: สีหน้ากังวล\nA: ความเครียดปานกลาง"),
      "นิสิตเล่า: เครียดสอบ\nสิ่งที่สังเกต: สีหน้ากังวล\nประเมิน: ความเครียดปานกลาง"
    );
    assert.equal(presentClinicalNote("P: นัดติดตาม"), "แผนการดูแล: นัดติดตาม");

    const soap = formatSoapNotePayload({
      subjective: "นอนไม่หลับ",
      objective: "ดูอ่อนเพลีย",
      assessment: "เครียดสูง",
      plan: "ส่งต่อ",
    });
    assert.match(soap.topic, /^นิสิตเล่า:/);
    assert.doesNotMatch(soap.action, /\b[SOAP]:/);

    const mh = formatMhCareNotePayload({
      subjective: "กังวลฝึกงาน",
      objective: "พูดช้า",
      assessment: "เครียดปานกลาง",
      plan: "นัดสัปดาห์หน้า",
    });
    assert.match(mh.summary, /นิสิตเล่า:/);
    assert.match(mh.interventionPlan, /^แผนการดูแล:/);
  });
});
