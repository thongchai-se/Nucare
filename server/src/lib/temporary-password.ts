import { randomBytes } from "crypto";

/** สร้างรหัสผ่านชั่วคราวแบบสุ่ม — ไม่คาดเดาจากรหัสนิสิต/อีเมล */
export function createTemporaryPassword(): string {
  return randomBytes(18).toString("base64url");
}
