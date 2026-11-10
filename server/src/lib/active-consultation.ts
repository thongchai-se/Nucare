import { ConsultationRequestStatus } from "@prisma/client";

/** สถานะคำขอที่ยังไม่จบ — นิสิตส่งคำขอใหม่ซ้ำไม่ได้จนกว่าจะปิดหรือยกเลิก */
export const ACTIVE_CONSULTATION_STATUSES: ConsultationRequestStatus[] = [
  ConsultationRequestStatus.PENDING,
  ConsultationRequestStatus.ACCEPTED,
  ConsultationRequestStatus.SCHEDULED,
  ConsultationRequestStatus.CANCEL_REQUESTED,
];

/** ตรวจว่าสถานะนี้ถือว่าคำขอยังเปิดอยู่ */
export function isActiveConsultationStatus(status: ConsultationRequestStatus): boolean {
  return (
    status === ConsultationRequestStatus.PENDING ||
    status === ConsultationRequestStatus.ACCEPTED ||
    status === ConsultationRequestStatus.SCHEDULED ||
    status === ConsultationRequestStatus.CANCEL_REQUESTED
  );
}

/** ข้อความเมื่อนิสิตมีคำขอเปิดอยู่แล้ว */
export function activeConsultationConflictMessage(status: ConsultationRequestStatus): string {
  if (status === ConsultationRequestStatus.SCHEDULED) {
    return "คุณมีนัดปรึกษาที่ยืนยันแล้วอยู่ กรุณาดำเนินการนัดนั้นให้เสร็จหรือขอปิดคำขอก่อนส่งคำขอใหม่";
  }
  if (status === ConsultationRequestStatus.CANCEL_REQUESTED) {
    return "คุณขอยกเลิกคำขอแล้ว รออาจารย์กดยกเลิกรับทราบก่อนส่งคำขอใหม่";
  }
  if (status === ConsultationRequestStatus.ACCEPTED) {
    return "คุณมีคำขอที่อาจารย์รับแล้วและกำลังประสานนัดอยู่ กรุณารอให้รอบนี้เสร็จก่อนส่งคำขอใหม่";
  }
  return "คุณมีคำขอปรึกษาที่รออาจารย์รับอยู่แล้ว กรุณารอตอบกลับก่อนส่งคำขอใหม่";
}
