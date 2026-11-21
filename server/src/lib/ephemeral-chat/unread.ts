/**
 * นับ/ตรวจข้อความที่ยังไม่อ่านในห้องแชทชั่วคราว
 */

export type SessionReadState = {
  studentId: string;
  staffId: string;
  lastMessageAt: Date | null;
  studentLastReadAt: Date | null;
  staffLastReadAt: Date | null;
  /** sender ของข้อความล่าสุด — ถ้าเป็นตัวเองไม่นับ unread */
  lastSenderId?: string | null;
};

/** ผู้ชมมีข้อความใหม่จากอีกฝ่ายหรือไม่ */
export function isSessionUnreadForViewer(
  viewerUserId: string,
  session: SessionReadState
): boolean {
  if (!session.lastMessageAt) {
    return false;
  }
  if (session.lastSenderId && session.lastSenderId === viewerUserId) {
    return false;
  }

  const lastReadAt =
    viewerUserId === session.studentId
      ? session.studentLastReadAt
      : viewerUserId === session.staffId
        ? session.staffLastReadAt
        : null;

  if (!lastReadAt) {
    return true;
  }
  return session.lastMessageAt.getTime() > lastReadAt.getTime();
}

/** นับจำนวนห้องที่มีข้อความยังไม่อ่าน — O(n) ตามจำนวนห้อง */
export function countUnreadSessions(
  viewerUserId: string,
  sessions: readonly SessionReadState[]
): number {
  let count = 0;
  for (const session of sessions) {
    if (isSessionUnreadForViewer(viewerUserId, session)) {
      count += 1;
    }
  }
  return count;
}
