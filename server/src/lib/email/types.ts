export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSendResult = {
  ok: boolean;
  provider: string;
  skipped?: boolean;
  error?: string;
};

/** ผู้ให้บริการส่งอีเมล — เปลี่ยนผ่าน env ได้โดยไม่แก้จุดเรียก */
export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export type EmailProviderKind = "console" | "smtp" | "http";
