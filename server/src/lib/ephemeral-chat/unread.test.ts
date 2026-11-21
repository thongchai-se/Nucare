import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { countUnreadSessions, isSessionUnreadForViewer } from "./unread";

describe("ephemeral-chat unread", () => {
  const base = {
    studentId: "s1",
    staffId: "t1",
    lastMessageAt: new Date("2026-11-19T10:00:00.000Z"),
    studentLastReadAt: null as Date | null,
    staffLastReadAt: null as Date | null,
    lastSenderId: "s1" as string | null,
  };

  it("ยังไม่อ่านเมื่อไม่มี lastRead และข้อความจากอีกฝ่าย", () => {
    assert.equal(
      isSessionUnreadForViewer("t1", { ...base, lastSenderId: "s1" }),
      true
    );
    assert.equal(
      isSessionUnreadForViewer("s1", { ...base, lastSenderId: "t1" }),
      true
    );
  });

  it("ไม่นับ unread ถ้าข้อความล่าสุดเป็นของตัวเอง", () => {
    assert.equal(
      isSessionUnreadForViewer("s1", { ...base, lastSenderId: "s1" }),
      false
    );
  });

  it("อ่านแล้วเมื่อ lastReadAt >= lastMessageAt", () => {
    assert.equal(
      isSessionUnreadForViewer("t1", {
        ...base,
        lastSenderId: "s1",
        staffLastReadAt: new Date("2026-11-19T10:00:00.000Z"),
      }),
      false
    );
    assert.equal(
      isSessionUnreadForViewer("t1", {
        ...base,
        lastSenderId: "s1",
        staffLastReadAt: new Date("2026-11-19T09:00:00.000Z"),
      }),
      true
    );
  });

  it("countUnreadSessions นับเฉพาะห้องที่ยังไม่อ่าน", () => {
    const count = countUnreadSessions("t1", [
      { ...base, lastSenderId: "s1" },
      {
        ...base,
        studentId: "s2",
        lastSenderId: "t1",
      },
      {
        ...base,
        studentId: "s3",
        lastSenderId: "s3",
        staffLastReadAt: new Date("2026-11-19T11:00:00.000Z"),
      },
    ]);
    assert.equal(count, 1);
  });
});
