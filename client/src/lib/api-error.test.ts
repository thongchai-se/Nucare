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

  it("API-03 แปล Internal server error เป็นภาษาคนอ่าน", () => {
    const error = {
      response: { data: { message: "Internal server error" } },
    };
    assert.equal(
      getApiErrorMessage(error, "บันทึกไม่สำเร็จ"),
      "ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง"
    );
  });

  it("API-04 ไม่โชว์ข้อความอังกฤษเทคนิคจาก Error", () => {
    assert.equal(
      getApiErrorMessage(new Error("ECONNREFUSED 127.0.0.1"), "ลองใหม่"),
      "ระบบมีปัญหาชั่วคราว กรุณาลองใหม่อีกครั้ง"
    );
  });

  it("API-05 แปล request entity too large / 413", () => {
    assert.equal(
      getApiErrorMessage(
        { response: { status: 413, data: { message: "request entity too large" } } },
        "บันทึกไม่สำเร็จ"
      ),
      "ไฟล์หรือข้อมูลที่ส่งมีขนาดใหญ่เกินไป กรุณาเลือกรูปไม่เกิน 2 MB แล้วลองใหม่"
    );
    assert.equal(
      getApiErrorMessage({ response: { status: 413, data: {} } }, "บันทึกไม่สำเร็จ"),
      "ไฟล์หรือข้อมูลที่ส่งมีขนาดใหญ่เกินไป กรุณาเลือกรูปไม่เกิน 2 MB แล้วลองใหม่"
    );
  });
});
