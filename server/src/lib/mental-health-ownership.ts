/**
 * ตรวจว่าผู้เชี่ยวชาญคนปัจจุบันเป็นเจ้าของเคสที่รับแล้วหรือไม่
 * เคสเก่าที่ยังไม่มี acceptedBy อนุญาตให้ดูแลต่อได้เพื่อไม่บล็อกข้อมูลเดิม
 */
export function canMutateAcceptedReferral(
  acceptedByUserId: string | null | undefined,
  actorUserId: string
): boolean {
  if (!acceptedByUserId) {
    return true;
  }
  return acceptedByUserId === actorUserId;
}

/** ข้อความเมื่อพยายามแก้เคสที่คนอื่นรับไว้แล้ว */
export function mentalHealthOwnershipDeniedMessage(): string {
  return "ดำเนินการได้เฉพาะผู้รับเคสนี้";
}

/**
 * ตัดบันทึกลับออกจากเซสชันดูแล — ใช้ตอนดูประวัติคิวก่อนรับเคส
 */
export function redactConfidentialCareNotes<T extends { confidentialNotes?: string | null }>(
  sessions: T[]
): Array<Omit<T, "confidentialNotes"> & { confidentialNotes: null }> {
  return sessions.map((session) => ({
    ...session,
    confidentialNotes: null,
  }));
}
