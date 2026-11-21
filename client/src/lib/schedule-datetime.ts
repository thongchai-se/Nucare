/** คืนค่า YYYY-MM-DD ตามเวลาท้องถิ่นสำหรับ min ของ input date */
export function localDateInputValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** คืนค่า YYYY-MM-DDTHH:mm ตามเวลาท้องถิ่นสำหรับ min ของ datetime-local */
export function localDatetimeInputValue(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** วันขั้นต่ำที่เลือกได้นัด = วันนี้ (กันเลือกวันย้อนหลัง) */
export function scheduleDateInputMin(now: Date = new Date()): string {
  return localDateInputValue(now);
}

/** วันเวลาขั้นต่ำที่เลือกได้นัด = ตอนนี้ */
export function scheduleDatetimeInputMin(now: Date = new Date()): string {
  return localDatetimeInputValue(now);
}

/** ตรวจว่าวันเวลานัดไม่ย้อนหลัง (เผื่อ clock skew เล็กน้อย 30 วินาที) */
export function isScheduleAtOnOrAfterNow(value: Date, now: Date = new Date(), skewMs = 30_000): boolean {
  return value.getTime() + skewMs >= now.getTime();
}
