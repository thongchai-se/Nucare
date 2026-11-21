import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlertPriority, AlertType } from "@prisma/client";
import { resetEmailProviderCache } from "./email";
import { chunkList, notifyManyUsers } from "./notify-batch";

describe("chunkList", () => {
  it("NB-01 แบ่งรายการเป็นชุดตามขนาด", () => {
    assert.deepEqual(chunkList([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(chunkList([], 3), []);
  });
});

describe("notifyManyUsers", () => {
  it("NB-02 สร้าง alert หลายแถวด้วย createMany", async () => {
    process.env.EMAIL_PROVIDER = "console";
    resetEmailProviderCache();

    const created: Array<Record<string, unknown>> = [];
    const fakeTx = {
      alert: {
        createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => {
          created.push(...data);
          return { count: data.length };
        },
      },
    };

    const result = await notifyManyUsers({
      recipients: [
        { userId: "u1", email: "a@example.com" },
        { userId: "u2", email: "b@example.com" },
      ],
      channels: { inApp: true, email: false },
      alert: {
        type: AlertType.HIGH_RISK_SCREENING,
        priority: AlertPriority.CRITICAL,
        title: "ทดสอบ",
        message: "ข้อความ",
        studentId: "s1",
      },
      tx: fakeTx as never,
    });

    assert.equal(result.alertCount, 2);
    assert.equal(created.length, 2);
    assert.equal(created[0]?.recipientUserId, "u1");
    assert.equal(created[1]?.recipientUserId, "u2");
  });

  it("NB-03 ส่งอีเมลเป็นชุดโดยไม่ล้มทั้งลูป", async () => {
    process.env.EMAIL_PROVIDER = "console";
    resetEmailProviderCache();

    const result = await notifyManyUsers({
      recipients: [
        { userId: "u1", email: "ok@example.com" },
        { userId: "u2", email: "also@example.com" },
      ],
      channels: { inApp: false, email: true },
      email: { subject: "หัวข้อ", text: "เนื้อหา" },
      emailConcurrency: 2,
    });

    assert.equal(result.alertCount, 0);
    assert.equal(result.emailSent, 2);
  });
});
