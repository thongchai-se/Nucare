import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getApiErrorMessage } from "./api-error";

describe("getApiErrorMessage", () => {
  it("API-01 ใช้ message จาก response ของ API", () => {
    const error = {
      response: { data: { message: "เคสนี้มีผู้รับแล้ว กรุณารีเฟรชรายการ" } },
    };
    assert.equal(getApiErrorMessage(error, "fallback"), "เคสนี้มีผู้รับแล้ว กรุณารีเฟรชรายการ");
  });

  it("API-02 ไม่โชว์ข้อความ Axios status code", () => {
    assert.equal(
      getApiErrorMessage(new Error("Request failed with status code 404"), "โหลดประวัติไม่สำเร็จ"),
      "โหลดประวัติไม่สำเร็จ"
    );
  });
});
