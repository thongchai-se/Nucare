import { ConsultationPreferredChannel, ConsultationRequestStatus } from "@prisma/client";

/** ช่องทางที่นิสิตเลือกตอนส่งคำขอ — แค่ออนไลน์หรือพบตัว */
export const STUDENT_REQUEST_CHANNELS = [
  ConsultationPreferredChannel.ONLINE,
  ConsultationPreferredChannel.IN_PERSON,
] as const;

export type StudentRequestChannel = (typeof STUDENT_REQUEST_CHANNELS)[number];

const channelLabels: Record<ConsultationPreferredChannel, string> = {
  ONLINE: "ออนไลน์",
  IN_PERSON: "พบตัว / ที่คณะ",
  PHONE: "โทรศัพท์",
  MESSAGE: "ข้อความในระบบ",
};

/** ป้ายช่องทางสำหรับแสดงผล (รองรับค่าเก่าในฐานข้อมูล) */
export function consultationChannelLabel(channel: ConsultationPreferredChannel): string {
  return channelLabels[channel];
}

/** ช่องทางที่เปิดให้นิสิตเลือกตอนสร้างคำขอ */
export function studentRequestChannelOptions(): Record<StudentRequestChannel, string> {
  return {
    ONLINE: channelLabels.ONLINE,
    IN_PERSON: channelLabels.IN_PERSON,
  };
}

/** ตรวจว่าเป็นช่องทางที่นิสิตเลือกได้ตอนสร้างคำขอ */
export function isStudentRequestChannel(value: string): value is StudentRequestChannel {
  return (
    value === ConsultationPreferredChannel.ONLINE ||
    value === ConsultationPreferredChannel.IN_PERSON
  );
}

/** คำใบ้ช่องกรอกสถานที่ตอนอาจารย์เสนอนัด */
export function scheduleLocationPlaceholder(channel: ConsultationPreferredChannel): string {
  if (channel === ConsultationPreferredChannel.ONLINE) {
    return "เช่น Microsoft Teams / Zoom พร้อมลิงก์";
  }
  return "เช่น ห้องที่ปรึกษาชั้น 2";
}

/**
 * นิสิตขอยกเลิกได้เมื่อยังไม่ยืนยันนัดและยังไม่ได้อยู่ในคิวยืนยันยกเลิก
 * — PENDING หรือ ACCEPTED
 */
export function canStudentCancelConsultation(status: ConsultationRequestStatus): boolean {
  return (
    status === ConsultationRequestStatus.PENDING ||
    status === ConsultationRequestStatus.ACCEPTED
  );
}

/** อาจารย์ยืนยันยกเลิกได้เมื่อนิสิตขอยกเลิกแล้ว */
export function canAdvisorConfirmCancelConsultation(status: ConsultationRequestStatus): boolean {
  return status === ConsultationRequestStatus.CANCEL_REQUESTED;
}

/**
 * อาจารย์ยกเลิกคิวได้เองก่อนนัดยืนยัน (ไม่ต้องรอนิสิต)
 * — PENDING หรือ ACCEPTED
 */
export function canAdvisorDirectCancelConsultation(status: ConsultationRequestStatus): boolean {
  return (
    status === ConsultationRequestStatus.PENDING ||
    status === ConsultationRequestStatus.ACCEPTED
  );
}

/** อาจารย์ปิดเคสหลังคุยจบได้เมื่อมีนัดยืนยันแล้ว */
export function canAdvisorCloseCompletedConsultation(status: ConsultationRequestStatus): boolean {
  return status === ConsultationRequestStatus.SCHEDULED;
}
