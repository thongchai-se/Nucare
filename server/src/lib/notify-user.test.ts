import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlertPriority, AlertType } from "@prisma/client";
import { resetEmailProviderCache } from "./email";

/**
 * เทสช่องทาง notifyUser โดย mock prisma.alert.create
 * ไม่แตะ DB จริง — โฟกัสว่าเลือกช่องทาง in-app / email ถูกต้อง
 */
describe("notifyUser channels", () => {
  it("creates in-app alert when channels.inApp and alert provided", async () => {
    process.env.EMAIL_PROVIDER = "console";
    resetEmailProviderCache();

    const created: Array<Record<string, unknown>> = [];
    const fakeTx = {
      alert: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          created.push(data);
          return { id: "alert-1" };
        },
      },
    };

    const { notifyUser } = await import("./notify-user");
    const result = await notifyUser({
      recipientUserId: "user-1",
      recipientEmail: "a@b.com",
      channels: { inApp: true, email: false },
      alert: {
        type: AlertType.ADVISOR_FOLLOW_UP,
        priority: AlertPriority.MEDIUM,
        title: "ทดสอบ",
        message: "ข้อความ",
      },
      tx: fakeTx as never,
    });

    assert.equal(result.alertId, "alert-1");
    assert.equal(result.emailSent, false);
    assert.equal(created.length, 1);
    assert.equal(created[0]?.title, "ทดสอบ");
  });

  it("sends email via console provider when channels.email", async () => {
    process.env.EMAIL_PROVIDER = "console";
    resetEmailProviderCache();

    const fakeTx = {
      alert: {
        create: async () => ({ id: "unused" }),
      },
    };

    const { notifyUser } = await import("./notify-user");
    const result = await notifyUser({
      recipientUserId: "user-2",
      recipientEmail: "student@example.com",
      channels: { inApp: false, email: true },
      email: {
        subject: "หัวข้อ",
        text: "เนื้อหา",
      },
      tx: fakeTx as never,
    });

    assert.equal(result.alertId, null);
    assert.equal(result.emailSent, true);
  });

  it("skips email when recipient address invalid", async () => {
    process.env.EMAIL_PROVIDER = "console";
    resetEmailProviderCache();

    const { notifyUser } = await import("./notify-user");
    const result = await notifyUser({
      recipientUserId: "user-3",
      recipientEmail: "not-valid",
      channels: { inApp: false, email: true },
      email: {
        subject: "x",
        text: "y",
      },
    });

    assert.equal(result.emailSent, false);
    assert.equal(result.emailSkipped, true);
  });
});
