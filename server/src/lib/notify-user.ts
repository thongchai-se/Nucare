import {
  AlertPriority,
  AlertType,
  Prisma,
} from "@prisma/client";
import { sendAppEmail } from "./email";
import { prisma } from "./prisma";

export type NotifyUserChannels = {
  inApp?: boolean;
  email?: boolean;
};

export type NotifyUserAlertInput = {
  actorUserId?: string | null;
  studentId?: string | null;
  type: AlertType;
  priority?: AlertPriority;
  title: string;
  message: string;
  sourceType?: string | null;
  sourceId?: string | null;
};

export type NotifyUserEmailInput = {
  subject: string;
  text: string;
  html?: string;
};

/**
 * ส่งแจ้งเตือนถึงผู้ใช้ผ่านช่องทางที่เลือก
 * in-app = สร้าง Alert · email = ส่งผ่าน EmailProvider (console/smtp/http)
 */
export async function notifyUser(input: {
  recipientUserId: string;
  recipientEmail?: string | null;
  channels: NotifyUserChannels;
  alert?: NotifyUserAlertInput;
  email?: NotifyUserEmailInput;
  tx?: Prisma.TransactionClient;
}): Promise<{
  alertId: string | null;
  emailSent: boolean;
  emailSkipped: boolean;
}> {
  const db = input.tx ?? prisma;
  const wantInApp = input.channels.inApp !== false && Boolean(input.alert);
  const wantEmail = Boolean(input.channels.email && input.email);

  let alertId: string | null = null;
  if (wantInApp && input.alert) {
    const created = await db.alert.create({
      data: {
        recipientUserId: input.recipientUserId,
        actorUserId: input.alert.actorUserId ?? null,
        studentId: input.alert.studentId ?? null,
        type: input.alert.type,
        priority: input.alert.priority ?? AlertPriority.MEDIUM,
        title: input.alert.title,
        message: input.alert.message,
        sourceType: input.alert.sourceType ?? null,
        sourceId: input.alert.sourceId ?? null,
      },
      select: { id: true },
    });
    alertId = created.id;
  }

  let emailSent = false;
  let emailSkipped = false;
  if (wantEmail && input.email) {
    const result = await sendAppEmail({
      to: input.recipientEmail || "",
      subject: input.email.subject,
      text: input.email.text,
      html: input.email.html,
    });
    emailSent = result.ok;
    emailSkipped = Boolean(result.skipped) || !result.ok;
    if (!result.ok && !result.skipped) {
      console.error("[notifyUser:email]", result.error);
    }
  }

  return { alertId, emailSent, emailSkipped };
}
