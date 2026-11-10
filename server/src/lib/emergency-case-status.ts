import { EmergencyCaseStatus } from "@prisma/client";

const ALLOWED_TRANSITIONS: Record<EmergencyCaseStatus, ReadonlySet<EmergencyCaseStatus>> = {
  [EmergencyCaseStatus.OPEN]: new Set([
    EmergencyCaseStatus.IN_PROGRESS,
    EmergencyCaseStatus.RESOLVED,
  ]),
  [EmergencyCaseStatus.IN_PROGRESS]: new Set([EmergencyCaseStatus.RESOLVED]),
  [EmergencyCaseStatus.RESOLVED]: new Set(),
};

/** ตรวจว่าสถานะเคสฉุกเฉิน (SOS) เปลี่ยนได้ตามลำดับหรือไม่ */
export function canTransitionEmergencyCaseStatus(
  from: EmergencyCaseStatus,
  to: EmergencyCaseStatus
): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_TRANSITIONS[from]?.has(to) ?? false;
}

/** ข้อความเมื่อเปลี่ยนสถานะ SOS ไม่ได้ */
export function emergencyCaseTransitionError(
  from: EmergencyCaseStatus,
  to: EmergencyCaseStatus
): string {
  if (from === EmergencyCaseStatus.RESOLVED) {
    return "เคสฉุกเฉินที่ปิดแล้วไม่สามารถเปลี่ยนสถานะได้";
  }
  if (from === EmergencyCaseStatus.OPEN && to === EmergencyCaseStatus.IN_PROGRESS) {
    return "รับดำเนินการได้จากสถานะรอรับเท่านั้น";
  }
  if (to === EmergencyCaseStatus.RESOLVED) {
    return "ปิดเคสได้จากสถานะรอรับหรือกำลังดำเนินการ";
  }
  return `ไม่สามารถเปลี่ยนสถานะจาก ${from} เป็น ${to}`;
}

/** ป้ายสถานะ SOS ภาษาไทยสำหรับ UI/แจ้งเตือน */
export function emergencyCaseStatusLabel(status: EmergencyCaseStatus): string {
  switch (status) {
    case EmergencyCaseStatus.OPEN:
      return "รอรับ";
    case EmergencyCaseStatus.IN_PROGRESS:
      return "กำลังดำเนินการ";
    case EmergencyCaseStatus.RESOLVED:
      return "ปิดแล้ว";
    default:
      return status;
  }
}
