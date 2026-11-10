import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runStudentSosRequest } from "./student-sos";

describe("runStudentSosRequest", () => {
  it("คืน ok เมื่อ submit สำเร็จ", async () => {
    const result = await runStudentSosRequest(async () => undefined);
    assert.deepEqual(result, { ok: true });
  });

  it("ไม่กลืน error และคืนข้อความเมื่อล้มเหลว", async () => {
    const result = await runStudentSosRequest(async () => {
      throw new Error("เครือข่ายล่ม");
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.message, /เครือข่ายล่ม|1323|SOS/);
    }
  });
});
