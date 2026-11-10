import { MentalHealthAppointmentStatus } from "@prisma/client";

const FROM_SCHEDULED = new Set<MentalHealthAppointmentStatus>([
  MentalHealthAppointmentStatus.CANCELLED,
  MentalHealthAppointmentStatus.COMPLETED,
  MentalHealthAppointmentStatus.NO_SHOW,
]);

/** นัดที่ยัง SCHEDULED เปลี่ยนเป็นยกเลิก/พบแล้ว/ไม่มาได้เท่านั้น */
export function canUpdateMentalHealthAppointmentStatus(
  from: MentalHealthAppointmentStatus,
  to: MentalHealthAppointmentStatus
): boolean {
  if (from !== MentalHealthAppointmentStatus.SCHEDULED) {
    return false;
  }
  return FROM_SCHEDULED.has(to);
}
