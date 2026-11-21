/** ตัดเหลือเฉพาะตัวเลข */
export function digitsOnlyPhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** จัดรูปเบอร์ไทยสำหรับแสดงผล — ว่างแสดง — */
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

/** ค่าสำหรับลิงก์ tel: — ไม่มีตัวเลขคืน null */
export function phoneTelHref(raw: string | null | undefined): string | null {
  const digits = digitsOnlyPhone(raw || "");
  return digits ? `tel:${digits}` : null;
}
