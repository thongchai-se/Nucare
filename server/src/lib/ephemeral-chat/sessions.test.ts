import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Role } from "@prisma/client";
import {
  buildStudentChatPeerListWhere,
  buildStudentChatPeerSearchWhere,
  getAsiaBangkokDayStart,
  isMessageAfterCursor,
  resolvePeerListPaging,
} from "./sessions";

describe("ephemeral-chat sessions helpers", () => {
  it("buildStudentChatPeerListWhere โชว์รายการได้แม้ไม่มีคำค้น", () => {
    const browse = buildStudentChatPeerListWhere("");
    assert.ok(browse);
    assert.equal(browse.role, Role.STUDENT);
    assert.equal(browse.isActive, true);
    assert.equal(browse.OR, undefined);
    assert.equal(browse.studyYear, undefined);

    const filtered = buildStudentChatPeerListWhere(" สม ");
    assert.ok(filtered);
    assert.ok(Array.isArray(filtered.OR));

    assert.equal(buildStudentChatPeerListWhere("", { mode: "ids", studentIds: [] }), null);
    const scoped = buildStudentChatPeerListWhere("", { mode: "ids", studentIds: ["s1"] });
    assert.ok(scoped);
    assert.deepEqual(scoped.id, { in: ["s1"] });

    const byYear = buildStudentChatPeerListWhere("", undefined, 2);
    assert.ok(byYear);
    assert.equal(byYear.studyYear, 2);
  });

  it("buildStudentChatPeerSearchWhere ต้องมีอย่างน้อย 2 ตัวอักษร และเคารพขอบเขต ids", () => {
    assert.equal(buildStudentChatPeerSearchWhere(" "), null);
    assert.equal(buildStudentChatPeerSearchWhere("ก"), null);
    assert.equal(buildStudentChatPeerSearchWhere("สมชาย", { mode: "ids", studentIds: [] }), null);
    const where = buildStudentChatPeerSearchWhere("  สมชาย  ");
    assert.ok(where);
    assert.equal(where.role, Role.STUDENT);
    assert.equal(where.isActive, true);
    assert.ok(Array.isArray(where.OR));
    assert.equal((where.OR as unknown[]).length, 2);
    const scoped = buildStudentChatPeerSearchWhere("สมชาย", { mode: "ids", studentIds: ["s1"] });
    assert.ok(scoped);
    assert.deepEqual(scoped.id, { in: ["s1"] });
  });

  it("resolvePeerListPaging ตัดหน้าและจำกัด pageSize", () => {
    assert.deepEqual(
      resolvePeerListPaging({ defaultPageSize: 10, maxPageSize: 20 }),
      { page: 1, pageSize: 10, skip: 0 }
    );
    assert.deepEqual(
      resolvePeerListPaging({ page: 3, pageSize: 10, defaultPageSize: 10, maxPageSize: 20 }),
      { page: 3, pageSize: 10, skip: 20 }
    );
    assert.equal(
      resolvePeerListPaging({ pageSize: 99, defaultPageSize: 10, maxPageSize: 20 }).pageSize,
      20
    );
  });

  it("isMessageAfterCursor เปรียบเทียบ createdAt แล้วใช้ id เป็น tie-break", () => {
    const older = { id: "a", createdAt: new Date("2026-01-01T10:00:00.000Z") };
    const newer = { id: "b", createdAt: new Date("2026-01-01T11:00:00.000Z") };
    const sameTimeLaterId = { id: "c", createdAt: new Date("2026-01-01T10:00:00.000Z") };

    assert.equal(isMessageAfterCursor(newer, null), true);
    assert.equal(isMessageAfterCursor(newer, older), true);
    assert.equal(isMessageAfterCursor(older, newer), false);
    assert.equal(isMessageAfterCursor(sameTimeLaterId, older), true);
    assert.equal(isMessageAfterCursor(older, sameTimeLaterId), false);
  });

  it("getAsiaBangkokDayStart คืนเที่ยงคืนไทยของวันนั้น", () => {
    // 19 พ.ย. 2569 15:00 ICT = 08:00 UTC
    const afternoon = new Date("2026-11-19T08:00:00.000Z");
    const dayStart = getAsiaBangkokDayStart(afternoon);
    assert.equal(dayStart.toISOString(), "2026-11-18T17:00:00.000Z"); // 00:00+07

    // หลังเที่ยงคืนไทยเล็กน้อย (00:30 ICT = 17:30 UTC วันก่อน)
    const justAfterMidnight = new Date("2026-11-18T17:30:00.000Z");
    const nextDayStart = getAsiaBangkokDayStart(justAfterMidnight);
    assert.equal(nextDayStart.toISOString(), "2026-11-18T17:00:00.000Z");
  });
});
