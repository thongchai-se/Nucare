import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WelfareTask } from "./types";
import {
  filterWelfareTasks,
  summarizeAcceptedOwnership,
  summarizeWelfareTasks,
} from "./welfare-queue";

const sample = (overrides: Partial<WelfareTask> & Pick<WelfareTask, "id" | "referralStatus">): WelfareTask => ({
  title: "นักศึกษา ตัวอย่าง",
  studentName: "นักศึกษา ตัวอย่าง",
  studentCode: "681100001-1",
  year: "1",
  owner: "อาจารย์ A",
  status: "รอประสานงาน",
  updatedAt: "อัปเดต",
  note: "ต้องการความช่วยเหลือด้านที่พัก",
  ...overrides,
});

describe("welfare queue filter", () => {
  it("WQ-01 นับสถานะและกรอง PENDING", () => {
    const tasks = [
      sample({ id: "1", referralStatus: "PENDING", status: "รอประสานงาน" }),
      sample({ id: "2", referralStatus: "ACCEPTED", status: "กำลังประสานงาน", studentName: "นิสิต B" }),
      sample({ id: "3", referralStatus: "CLOSED", status: "ปิดเคสแล้ว" }),
    ];
    assert.deepEqual(summarizeWelfareTasks(tasks), {
      ALL: 3,
      PENDING: 1,
      ACCEPTED: 1,
      CLOSED: 1,
    });
    assert.equal(filterWelfareTasks(tasks, "PENDING", "").length, 1);
    assert.equal(filterWelfareTasks(tasks, "ALL", "นิสิต B").length, 1);
  });

  it("WQ-02 คำค้นว่างและสถานะ ALL คืนครบ", () => {
    const tasks = [sample({ id: "1", referralStatus: "CLOSED", status: "ปิดเคสแล้ว" })];
    assert.equal(filterWelfareTasks(tasks, "ALL", "  ").length, 1);
  });

  it("WQ-03 กรองกำลังประสานแบบของฉัน / ทั้งหมด", () => {
    const tasks = [
      sample({
        id: "mine",
        referralStatus: "ACCEPTED",
        status: "กำลังประสานงาน",
        acceptedByUserId: "sd-1",
        acceptedByName: "ฉัน",
      }),
      sample({
        id: "other",
        referralStatus: "ACCEPTED",
        status: "กำลังประสานงาน",
        acceptedByUserId: "sd-2",
        acceptedByName: "เพื่อน",
        studentName: "นิสิตอื่น",
      }),
    ];
    assert.deepEqual(summarizeAcceptedOwnership(tasks, "sd-1"), { mine: 1, all: 2 });
    assert.equal(
      filterWelfareTasks(tasks, "ACCEPTED", "", {
        ownershipScope: "mine",
        currentUserId: "sd-1",
      }).length,
      1
    );
    assert.equal(
      filterWelfareTasks(tasks, "ACCEPTED", "", {
        ownershipScope: "all",
        currentUserId: "sd-1",
      }).length,
      2
    );
  });
});
