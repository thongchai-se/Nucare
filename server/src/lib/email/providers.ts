import nodemailer from "nodemailer";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

const readEnv = (key: string): string | undefined => {
  const value = process.env[key];
  return value && value.trim() ? value.trim() : undefined;
};

/** โหมดพัฒนา — เขียนลง log แทนส่งจริง */
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    console.info("[email:console]", {
      to: message.to,
      subject: message.subject,
      text: message.text.slice(0, 280),
    });
    return { ok: true, provider: this.name };
  }
}

/** ส่งผ่าน SMTP มาตรฐาน (Gmail / Office365 / เมลคณะ) */
export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const host = readEnv("SMTP_HOST") || "smtp.gmail.com";
    const port = Number(readEnv("SMTP_PORT") || "587");
    const secure = `${readEnv("SMTP_SECURE") || "false"}`.toLowerCase() !== "false";
    const user = readEnv("SMTP_USER");
    const pass = readEnv("SMTP_PASS");
    const from = readEnv("SMTP_FROM") || user;

    if (!user || !pass || !from) {
      return {
        ok: false,
        provider: this.name,
        skipped: true,
        error: "SMTP_USER / SMTP_PASS / SMTP_FROM is not configured",
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
      await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { ok: true, provider: this.name };
    } catch (error) {
      return {
        ok: false,
        provider: this.name,
        error: error instanceof Error ? error.message : "SMTP send failed",
      };
    }
  }
}

/**
 * ส่งผ่าน HTTP API ของมหาวิทยาลัย / เกตเวย์ภายนอก
 * ตั้ง EMAIL_HTTP_URL + optional EMAIL_HTTP_TOKEN / EMAIL_HTTP_AUTH_HEADER
 * Body มาตรฐาน: { to, subject, text, html, from? } — ปรับชื่อฟิลด์ได้ด้วย EMAIL_HTTP_FIELD_*
 */
export class HttpApiEmailProvider implements EmailProvider {
  readonly name = "http";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const url = readEnv("EMAIL_HTTP_URL");
    if (!url) {
      return {
        ok: false,
        provider: this.name,
        skipped: true,
        error: "EMAIL_HTTP_URL is not configured",
      };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    const token = readEnv("EMAIL_HTTP_TOKEN");
    const authHeader = readEnv("EMAIL_HTTP_AUTH_HEADER") || "Authorization";
    if (token) {
      headers[authHeader] = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }

    const toKey = readEnv("EMAIL_HTTP_FIELD_TO") || "to";
    const subjectKey = readEnv("EMAIL_HTTP_FIELD_SUBJECT") || "subject";
    const textKey = readEnv("EMAIL_HTTP_FIELD_TEXT") || "text";
    const htmlKey = readEnv("EMAIL_HTTP_FIELD_HTML") || "html";
    const fromKey = readEnv("EMAIL_HTTP_FIELD_FROM") || "from";
    const fromValue = readEnv("EMAIL_HTTP_FROM") || readEnv("SMTP_FROM");

    const payload: Record<string, string | null> = {
      [toKey]: message.to,
      [subjectKey]: message.subject,
      [textKey]: message.text,
      [htmlKey]: message.html ?? null,
    };
    if (fromValue) {
      payload[fromKey] = fromValue;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        return {
          ok: false,
          provider: this.name,
          error: `HTTP ${response.status}${bodyText ? `: ${bodyText.slice(0, 200)}` : ""}`,
        };
      }

      return { ok: true, provider: this.name };
    } catch (error) {
      return {
        ok: false,
        provider: this.name,
        error: error instanceof Error ? error.message : "HTTP email send failed",
      };
    }
  }
}
