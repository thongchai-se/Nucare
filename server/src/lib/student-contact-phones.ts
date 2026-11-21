/**
 * ตรวจและจัดรูปเบอร์โทรที่นิสิตแก้เองได้
 * — เก็บเฉพาะตัวเลข อนุญาตว่าง (ล้างค่า) หรือเบอร์ไทยขึ้นต้น 0 ความยาว 9–10 หลัก
 */

const THAI_PHONE_DIGITS = /^0\d{8,9}$/;

export type StudentContactPhones = {
  phone: string | null;
  guardianPhone: string | null;
};

/** ตัดอักขระที่ไม่ใช่ตัวเลขออก เหลือเฉพาะหลัก */
export function digitsOnlyPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** จัดรูปเบอร์สำหรับแสดงผล (ว่างแสดง —) */
export function formatThaiPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) {
    return "—";
  }
  const digits = digitsOnlyPhone(raw);
  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 9) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw.trim() || "—";
}

/**
 * แปลงอินพุตเบอร์เป็นค่าเก็บในฐานข้อมูล
 * — ค่าว่าง → null · ไม่ผ่านรูปแบบ → throw Error ข้อความภาษาไทย
 */
export function normalizeStudentPhoneInput(raw: string, fieldLabel: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const digits = digitsOnlyPhone(trimmed);
  if (!THAI_PHONE_DIGITS.test(digits)) {
    throw new Error(`${fieldLabel}ต้องเป็นเบอร์ไทยขึ้นต้นด้วย 0 ความยาว 9–10 หลัก`);
  }

  return digits;
}

/** ตรวจคู่เบอร์โทรนิสิต/ผู้ปกครอง — คืนค่าพร้อมเก็บ หรือข้อความผิดพลาด */
export function parseStudentContactPhones(input: {
  phone?: string;
  guardianPhone?: string;
}): { ok: true; value: StudentContactPhones } | { ok: false; message: string } {
  try {
    return {
      ok: true,
      value: {
        phone: normalizeStudentPhoneInput(input.phone ?? "", "เบอร์โทรศัพท์มือถือ"),
        guardianPhone: normalizeStudentPhoneInput(input.guardianPhone ?? "", "เบอร์ผู้ปกครอง"),
      },
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "เบอร์โทรไม่ถูกต้อง",
    };
  }
}
