import { AlertPriority, type Prisma } from "@prisma/client";
import { sendAppEmail } from "./email";
import {
  type NotifyUserAlertInput,
  type NotifyUserChannels,
  type NotifyUserEmailInput,
} from "./notify-user";
import { prisma } from "./prisma";

const DEFAULT_EMAIL_CONCURRENCY = 5;

export type NotifyRecipient = {
  userId: string;
  email?: string | null;
};

/** แบ่งรายการเป็นชุดย่อยขนาดคงที่ — O(n) */
export function chunkList<T>(items: readonly T[], size: number): T[][] {
  const chunkSize = Math.max(1, Math.floor(size));
  if (items.length === 0) {
    return [];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

/**
 * แจ้งหลายผู้รับด้วยเนื้อหาเดียวกัน — in-app ใช้ createMany, อีเมลส่งเป็นชุดย่อย
 * ไม่ throw เมื่ออีเมลบางฉบับล้มเหลว
 */
export async function notifyManyUsers(input: {
  recipients: readonly NotifyRecipient[];
  channels: NotifyUserChannels;
  alert?: NotifyUserAlertInput;
  email?: NotifyUserEmailInput;
  emailConcurrency?: number;
  tx?: Prisma.TransactionClient;
}): Promise<{
  alertCount: number;
  emailSent: number;
  emailSkipped: number;
}> {
  const db = input.tx ?? prisma;
  const recipients = input.recipients.filter((row) => Boolean(row.userId));
  if (recipients.length === 0) {
    return { alertCount: 0, emailSent: 0, emailSkipped: 0 };
  }

  const wantInApp = input.channels.inApp !== false && Boolean(input.alert);
  const wantEmail = Boolean(input.channels.email && input.email);

  let alertCount = 0;
  if (wantInApp && input.alert) {
    const created = await db.alert.createMany({
      data: recipients.map((recipient) => ({
        recipientUserId: recipient.userId,
        actorUserId: input.alert?.actorUserId ?? null,
        studentId: input.alert?.studentId ?? null,
        type: input.alert!.type,
        priority: input.alert!.priority ?? AlertPriority.MEDIUM,
        title: input.alert!.title,
        message: input.alert!.message,
        sourceType: input.alert?.sourceType ?? null,
        sourceId: input.alert?.sourceId ?? null,
      })),
    });
    alertCount = created.count;
  }

  let emailSent = 0;
  let emailSkipped = 0;
  if (wantEmail && input.email) {
    const concurrency = input.emailConcurrency ?? DEFAULT_EMAIL_CONCURRENCY;
    for (const batch of chunkList(recipients, concurrency)) {
      const results = await Promise.allSettled(
        batch.map((recipient) =>
          sendAppEmail({
            to: recipient.email || "",
            subject: input.email!.subject,
            text: input.email!.text,
            html: input.email!.html,
          })
        )
      );
      for (const result of results) {
        if (result.status !== "fulfilled") {
          emailSkipped += 1;
          console.error("[notifyManyUsers:email]", result.reason);
          continue;
        }
        if (result.value.ok) {
          emailSent += 1;
        } else {
          emailSkipped += 1;
          if (!result.value.skipped) {
            console.error("[notifyManyUsers:email]", result.value.error);
          }
        }
      }
    }
  }

  return { alertCount, emailSent, emailSkipped };
}
