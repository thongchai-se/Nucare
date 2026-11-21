import { Role } from "@prisma/client";

/** บทบาทบุคลากรที่นิสิตแชทชั่วคราวได้ */
export const EPHEMERAL_CHAT_STAFF_ROLES = [
  Role.ADVISOR,
  Role.INSTRUCTOR,
  Role.MENTAL_HEALTH,
  Role.STUDENT_DEVELOPMENT,
] as const;

export type EphemeralChatStaffRole = (typeof EPHEMERAL_CHAT_STAFF_ROLES)[number];

/** ความยาวข้อความสูงสุดต่อครั้ง */
export const EPHEMERAL_CHAT_MAX_BODY_LENGTH = 2000;

/** จำนวนข้อความที่ดึงต่อครั้งตอนเปิดห้อง / poll */
export const EPHEMERAL_CHAT_MESSAGE_PAGE_SIZE = 50;

/** จำนวนนิสิตต่อหน้าในไดเรกทอรีข้อความบุคลากร */
export const EPHEMERAL_CHAT_PEER_PAGE_SIZE = 10;

/** เพดาน pageSize ที่ client ขอได้ */
export const EPHEMERAL_CHAT_PEER_PAGE_SIZE_MAX = 20;

/**
 * เพดานข้อความทั้งระบบ — เกินแล้วลบห้องเก่าทันทีเพื่อลดภาระเซิร์ฟเวอร์
 * ปรับด้วย EPHEMERAL_CHAT_MAX_MESSAGES
 */
export const EPHEMERAL_CHAT_MAX_MESSAGES = 3000;

/** หลังลบด้วยแรงดัน ให้เหลือไม่เกินสัดส่วนนี้ของเพดาน */
export const EPHEMERAL_CHAT_PRESSURE_TARGET_RATIO = 0.7;

/** ป้ายบทบาทสำหรับรายชื่อเพื่อนคุย */
export const EPHEMERAL_CHAT_STAFF_ROLE_LABELS: Record<EphemeralChatStaffRole, string> = {
  ADVISOR: "อาจารย์ที่ปรึกษา",
  INSTRUCTOR: "อาจารย์ผู้สอน",
  MENTAL_HEALTH: "ผู้เชี่ยวชาญสุขภาพจิต",
  STUDENT_DEVELOPMENT: "งานพัฒนานิสิต",
};
