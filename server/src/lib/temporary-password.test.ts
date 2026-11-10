import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTemporaryPassword } from "./temporary-password";

describe("createTemporaryPassword", () => {
  it("TP-01 ได้สตริงยาวพอและไม่ซ้ำในชุดตัวอย่าง", () => {
    const samples = Array.from({ length: 20 }, () => createTemporaryPassword());
    for (const sample of samples) {
      assert.ok(sample.length >= 16);
      assert.doesNotMatch(sample, /^Nu/i);
    }
    assert.equal(new Set(samples).size, samples.length);
  });
});
