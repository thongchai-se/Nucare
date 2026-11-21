/**
 * ตัดสินว่าควรปิดคิวส่งต่อหลังมีผู้เชี่ยวชาญปฏิเสธหรือยัง
 * — ปิดเมื่อผู้เชี่ยวชาญที่ยังใช้งานทุกคนอยู่ในรายการปฏิเสธแล้ว
 */
export function shouldCloseReferralAfterDeclines(input: {
  activeExpertIds: readonly string[];
  declinedUserIds: readonly string[];
}): boolean {
  const active = [...new Set(input.activeExpertIds.filter(Boolean))];
  if (active.length === 0) {
    return true;
  }

  const declined = new Set(input.declinedUserIds.filter(Boolean));
  return active.every((id) => declined.has(id));
}

/** รวมรายการปฏิเสธเดิมกับผู้ใช้ที่เพิ่งปฏิเสธ (กันซ้ำ) — O(n) */
export function mergeDeclinedUserIds(
  existingDeclinedUserIds: readonly string[],
  nextUserId: string
): string[] {
  const merged = new Set(existingDeclinedUserIds.filter(Boolean));
  if (nextUserId) {
    merged.add(nextUserId);
  }
  return [...merged];
}
