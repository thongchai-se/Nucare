import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FRIENDLY_INTERNAL_ERROR,
  FRIENDLY_PAYLOAD_TOO_LARGE,
  isPayloadTooLargeError,
  resolveUnhandledHttpError,
} from "./http-error-message";

describe("http-error-message", () => {
  it("HE-01 ตรวจ PayloadTooLarge จาก type entity.too.large", () => {
    assert.equal(isPayloadTooLargeError({ type: "entity.too.large", status: 413 }), true);
    assert.equal(isPayloadTooLargeError({ name: "PayloadTooLargeError" }), true);
    assert.equal(isPayloadTooLargeError({ message: "request entity too large" }), true);
    assert.equal(isPayloadTooLargeError({ message: "boom" }), false);
  });

  it("HE-02 แปลงเป็นข้อความไทยและสถานะที่ถูกต้อง", () => {
    assert.deepEqual(resolveUnhandledHttpError({ type: "entity.too.large" }), {
      status: 413,
      message: FRIENDLY_PAYLOAD_TOO_LARGE,
    });
    assert.deepEqual(resolveUnhandledHttpError(new Error("unexpected")), {
      status: 500,
      message: FRIENDLY_INTERNAL_ERROR,
    });
  });
});
