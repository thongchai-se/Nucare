import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  digitsOnlyPhone,
  formatThaiPhoneDisplay,
  normalizeStudentPhoneInput,
  parseStudentContactPhones,
} from "./student-contact-phones";

describe("student-contact-phones", () => {
  it("SCP-01 ตัดอักขระและรับเบอร์ไทยถูกต้อง", () => {
    assert.equal(digitsOnlyPhone("081-234-5678"), "0812345678");
    assert.equal(normalizeStudentPhoneInput("081-234-5678", "เบอร์"), "0812345678");
    assert.equal(normalizeStudentPhoneInput("  ", "เบอร์"), null);
    assert.equal(formatThaiPhoneDisplay("0812345678"), "081-234-5678");
    assert.equal(formatThaiPhoneDisplay(null), "—");
  });

  it("SCP-02 ปฏิเสธรูปแบบที่ไม่ใช่เบอร์ไทย", () => {
    assert.throws(() => normalizeStudentPhoneInput("12345", "เบอร์โทรศัพท์มือถือ"), /เบอร์โทรศัพท์มือถือ/);
    assert.throws(() => normalizeStudentPhoneInput("66812345678", "เบอร์"), /เบอร์/);
  });

  it("SCP-03 parse คู่เบอร์ผ่านและล้มเมื่อผิด", () => {
    const ok = parseStudentContactPhones({
      phone: "043-202-407",
      guardianPhone: "",
    });
    assert.equal(ok.ok, true);
    if (ok.ok) {
      assert.equal(ok.value.phone, "043202407");
      assert.equal(ok.value.guardianPhone, null);
    }

    const bad = parseStudentContactPhones({ phone: "abc", guardianPhone: "0812345678" });
    assert.equal(bad.ok, false);
  });
});
