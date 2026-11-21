import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildToastTimerLeftLabel,
  computeToastElapsedProgress,
  consultationStatusToastMessage,
  consultationStatusToastTone,
  EXPANDABLE_TOAST_DURATION_MS,
  formatToastCountdownSeconds,
  resolveActionToastPresentation,
  resolveExpandableToastContent,
} from "./expandable-toast";

describe("expandable toast helpers", () => {
  it("ET-01 นับวินาทีปัดขึ้นและกันค่าติดลบ", () => {
    assert.equal(formatToastCountdownSeconds(14_200), 15);
    assert.equal(formatToastCountdownSeconds(1000), 1);
    assert.equal(formatToastCountdownSeconds(1), 1);
    assert.equal(formatToastCountdownSeconds(0), 0);
    assert.equal(formatToastCountdownSeconds(-5), 0);
  });

  it("ET-02 แถบเวลาเดินตามสัดส่วนที่ผ่านไป", () => {
    assert.equal(computeToastElapsedProgress(15_000, 15_000), 0);
    assert.equal(computeToastElapsedProgress(7500, 15_000), 0.5);
    assert.equal(computeToastElapsedProgress(0, 15_000), 1);
    assert.equal(computeToastElapsedProgress(100, 0), 1);
  });

  it("ET-03 ข้อความซ้าย footer ตามวินาทีที่เหลือ", () => {
    assert.equal(buildToastTimerLeftLabel(14), "ข้อความนี้จะปิดใน 14 วินาที");
    assert.equal(buildToastTimerLeftLabel(0), "กำลังปิดข้อความ…");
    assert.equal(EXPANDABLE_TOAST_DURATION_MS, 15_000);
  });

  it("ET-04 ไม่เติม body สำรอง และปิดขยายเป็นค่าเริ่มต้น", () => {
    const bare = resolveExpandableToastContent({
      title: "ลิงก์หมดอายุ",
      tone: "error",
    });
    assert.equal(bare.title, "ลิงก์หมดอายุ");
    assert.equal(bare.description, "");
    assert.equal(bare.hasDetail, false);
    assert.equal(bare.expandByDefault, false);

    const kept = resolveExpandableToastContent({
      title: "SOS จากนิสิตในดูแล",
      description: "มีคำขอช่วยเหลือด่วนจากนิสิตทดสอบ",
      tone: "warning",
    });
    assert.equal(kept.description, "มีคำขอช่วยเหลือด่วนจากนิสิตทดสอบ");
    assert.equal(kept.hasDetail, true);
    assert.equal(kept.expandByDefault, false);

    const dup = resolveExpandableToastContent({
      title: "บันทึกแล้ว",
      description: "บันทึกแล้ว",
      tone: "success",
    });
    assert.equal(dup.description, "");
    assert.equal(dup.hasDetail, false);
  });

  it("ET-05 ใช้ข้อความการกระทำเป็นหัวข้อ และแยกรายละเอียดยาวออกจากหัวข้อ", () => {
    const ack = resolveActionToastPresentation({
      message: "รับเรื่องแล้ว",
      tone: "info",
    });
    assert.equal(ack.title, "รับเรื่องแล้ว");
    assert.equal(ack.description, undefined);

    const split = resolveActionToastPresentation({
      message: "รับเคสสำเร็จ — ไปเมนูเคสที่ดูแลเพื่อนัดหรือบันทึกผล",
      tone: "success",
    });
    assert.equal(split.title, "รับเคสสำเร็จ");
    assert.equal(split.description, "ไปเมนูเคสที่ดูแลเพื่อนัดหรือบันทึกผล");

    const titled = resolveActionToastPresentation({
      message: "ignored",
      title: "ปิดเคสสำเร็จ",
      description: "ออกจากรายการกำลังดูแลแล้ว",
      tone: "success",
    });
    assert.equal(titled.title, "ปิดเคสสำเร็จ");
    assert.equal(titled.description, "ออกจากรายการกำลังดูแลแล้ว");

    const err = resolveActionToastPresentation({
      message: "ไม่พบรายการ",
      tone: "error",
    });
    assert.equal(err.title, "ดำเนินการไม่สำเร็จ");
    assert.equal(err.description, "ไม่พบรายการ");

    assert.equal(consultationStatusToastMessage("ACCEPTED"), "รับคำขอปรึกษาแล้ว");
    assert.equal(consultationStatusToastMessage("CANCELLED"), "ยกเลิกคำขอปรึกษาแล้ว");
    assert.equal(consultationStatusToastMessage("CLOSED"), "ปิดเคสปรึกษาแล้ว");
    assert.equal(consultationStatusToastTone("ACCEPTED"), "success");
    assert.equal(consultationStatusToastTone("CANCELLED"), "warning");
    assert.equal(consultationStatusToastTone("CANCEL_REQUESTED"), "warning");
  });
});
