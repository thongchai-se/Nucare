import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatThaiPhoneDisplay, phoneTelHref } from "./phone-display";

describe("phone-display", () => {
  it("PD-01 จัดรูปและสร้าง tel link", () => {
    assert.equal(formatThaiPhoneDisplay("0812345678"), "081-234-5678");
    assert.equal(formatThaiPhoneDisplay(""), "—");
    assert.equal(phoneTelHref("081-234-5678"), "tel:0812345678");
    assert.equal(phoneTelHref(null), null);
  });
});
