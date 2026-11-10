import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getNameInitials,
  getPersonalNameParts,
  looksLikeStudentCodeMark,
  resolveRosterAvatarMark,
  stripKnownNamePrefix,
} from "./name-prefix";

describe("stripKnownNamePrefix", () => {
  it("strips student titles", () => {
    assert.equal(stripKnownNamePrefix("นาย สมชาย ใจดี"), "สมชาย ใจดี");
    assert.equal(stripKnownNamePrefix("นางสาวสมหญิง รักดี"), "สมหญิง รักดี");
    assert.equal(stripKnownNamePrefix("น.ส. มาลี สุขใจ"), "มาลี สุขใจ");
    assert.equal(stripKnownNamePrefix("ด.ช.เด็กดี ดีมาก"), "เด็กดี ดีมาก");
  });

  it("strips academic staff titles", () => {
    assert.equal(stripKnownNamePrefix("อ.ดร.สมชาย ใจดี"), "สมชาย ใจดี");
    assert.equal(stripKnownNamePrefix("ผศ.ดร. วิชัย ใจดี"), "วิชัย ใจดี");
    assert.equal(stripKnownNamePrefix("รศ.ดร.สมศรี ดีมาก"), "สมศรี ดีมาก");
    assert.equal(stripKnownNamePrefix("อาจารย์ สมปอง ใจดี"), "สมปอง ใจดี");
  });

  it("strips stacked titles", () => {
    assert.equal(stripKnownNamePrefix("อ.ดร.นายสมชาย ใจดี"), "สมชาย ใจดี");
  });
});

describe("getNameInitials", () => {
  it("uses given + family first letters only (not the title)", () => {
    assert.equal(getNameInitials("นาย สมชาย ใจดี"), "สจ");
    assert.equal(getNameInitials("นางสาว สมหญิง รักดี"), "สร");
    assert.equal(getNameInitials("ผศ.ดร.วิชัย ใจดี"), "วจ");
    assert.equal(getNameInitials("อ.ดร.สมชาย ใจดี"), "สจ");
    assert.equal(getNameInitials("Mr. John Smith"), "JS");
  });

  it("skips Thai leading vowels when picking the consonant", () => {
    // "ใจดี" เริ่มด้วยสระ ใ ใน Unicode — ต้องย่อเป็น จ ไม่ใช่ ใ
    assert.equal(getNameInitials("นาย เอกลักษณ์ ใจดี"), "อจ");
  });

  it("uses first and last parts when there are middle names", () => {
    assert.equal(getNameInitials("นาย สมชาย กลาง ใจดี"), "สจ");
    assert.deepEqual(getPersonalNameParts("นาย สมชาย กลาง ใจดี"), ["สมชาย", "กลาง", "ใจดี"]);
  });

  it("falls back safely for empty names", () => {
    assert.equal(getNameInitials("นาย", "NU"), "NU");
    assert.equal(getNameInitials("   ", "XX"), "XX");
  });
});

describe("resolveRosterAvatarMark", () => {
  it("ไม่ใช้ท้ายรหัสนิสิตเป็นอวตาร์", () => {
    assert.equal(resolveRosterAvatarMark("นางสาว จิราพร ใจดี", "681100180-0"), "จจ");
    assert.equal(looksLikeStudentCodeMark("681100180-0"), true);
    assert.equal(looksLikeStudentCodeMark("จจ"), false);
    assert.equal(resolveRosterAvatarMark("นาย สมชาย ใจดี", "สจ"), "สจ");
  });
});
