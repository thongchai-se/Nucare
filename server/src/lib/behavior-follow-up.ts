import { AlertStatus } from "@prisma/client";

export type BehaviorFollowUpStatus = "PENDING" | "ACKNOWLEDGED" | "COMPLETED";

/**
 * สรุปสถานะการติดตามจาก Alert ของที่ปรึกษาทุกคนที่ได้รับเรื่อง
 * COMPLETED เมื่อปิดครบทุกใบ; ACKNOWLEDGED เมื่อมีอย่างน้อยหนึ่งใบที่รับ/ปิดแล้ว
 */
export function getBehaviorRecordFollowUpStatus(
  statuses: readonly AlertStatus[]
): BehaviorFollowUpStatus {
  if (statuses.length === 0) {
    return "PENDING";
  }

  if (statuses.every((status) => status === AlertStatus.CLOSED)) {
    return "COMPLETED";
  }

  if (statuses.some((status) => status === AlertStatus.ACKNOWLEDGED || status === AlertStatus.CLOSED)) {
    return "ACKNOWLEDGED";
  }

  return "PENDING";
}
