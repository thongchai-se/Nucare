/** ตัดแท็ก demo / คำนำยาวออกจากข้อความที่โชว์ใน UI */
export function sanitizeDisplayNote(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .replace(/^\[TEMP_BULK_DEMO\]\s*/i, "")
    .replace(/^ส่งต่อสวัสดิการ\s*[—–-]\s*/i, "")
    .trim();
}
