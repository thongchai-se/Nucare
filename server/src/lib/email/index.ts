import { ConsoleEmailProvider, HttpApiEmailProvider, SmtpEmailProvider } from "./providers";
import type { EmailMessage, EmailProvider, EmailProviderKind, EmailSendResult } from "./types";

export type { EmailMessage, EmailProvider, EmailProviderKind, EmailSendResult };

let cachedProvider: EmailProvider | null = null;

/** อ่านชนิด provider จาก env — ค่าเริ่มต้น console เพื่อไม่พังตอนยังไม่มี SMTP */
export function resolveEmailProviderKind(): EmailProviderKind {
  const raw = `${process.env.EMAIL_PROVIDER || "console"}`.trim().toLowerCase();
  if (raw === "smtp" || raw === "http" || raw === "console") {
    return raw;
  }
  return "console";
}

/** กัน production ใช้ console email โดยไม่ตั้งใจ และตรวจว่า env พร้อมส่งจริง */
export function assertEmailReadyForEnvironment(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (`${process.env.ALLOW_CONSOLE_EMAIL || ""}`.trim().toLowerCase() === "true") {
    return;
  }

  const kind = resolveEmailProviderKind();
  if (kind === "console") {
    throw new Error(
      "Production requires EMAIL_PROVIDER=smtp|http (or set ALLOW_CONSOLE_EMAIL=true for a controlled exception)"
    );
  }

  if (kind === "smtp") {
    const user = `${process.env.SMTP_USER || ""}`.trim();
    const pass = `${process.env.SMTP_PASS || ""}`.trim();
    const from = `${process.env.SMTP_FROM || process.env.SMTP_USER || ""}`.trim();
    if (!user || !pass || !from) {
      throw new Error("Production SMTP requires SMTP_USER, SMTP_PASS, and SMTP_FROM (or SMTP_USER as from)");
    }
  }

  if (kind === "http") {
    const url = `${process.env.EMAIL_HTTP_URL || ""}`.trim();
    if (!url) {
      throw new Error("Production HTTP email requires EMAIL_HTTP_URL");
    }
  }
}

/** สร้างผู้ให้บริการส่งอีเมลตาม env */
export function createEmailProvider(kind: EmailProviderKind = resolveEmailProviderKind()): EmailProvider {
  if (kind === "smtp") {
    return new SmtpEmailProvider();
  }
  if (kind === "http") {
    return new HttpApiEmailProvider();
  }
  return new ConsoleEmailProvider();
}

/** คืน provider แบบ cache ต่อ process */
export function getEmailProvider(): EmailProvider {
  if (!cachedProvider) {
    cachedProvider = createEmailProvider();
  }
  return cachedProvider;
}

/** ใช้ในเทสเท่านั้น — รีเซ็ต cache ของ provider */
export function resetEmailProviderCache(): void {
  cachedProvider = null;
}

/** ส่งอีเมลธุรกรรมผ่าน provider ที่ตั้งค่าไว้ */
export async function sendAppEmail(message: EmailMessage): Promise<EmailSendResult> {
  const to = message.to.trim();
  if (!to || !to.includes("@")) {
    return { ok: false, provider: getEmailProvider().name, skipped: true, error: "Invalid recipient email" };
  }

  return getEmailProvider().send({
    ...message,
    to,
    subject: message.subject.trim(),
    text: message.text.trim(),
    html: message.html?.trim() || undefined,
  });
}
