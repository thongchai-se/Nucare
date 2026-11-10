import type { AdvisorConsultationRequestItem } from "./types";

export type NegotiateLane = "waiting_advisor" | "waiting_student" | "no_offer";

/** แยกคิวเจรจานัดในสถานะ ACCEPTED ตามว่าใครต้องตอบ */
export function getNegotiateLane(request: AdvisorConsultationRequestItem): NegotiateLane {
  const waitingOn = request.latestPendingOffer?.waitingOn ?? null;
  if (waitingOn === "ADVISOR") return "waiting_advisor";
  if (waitingOn === "STUDENT") return "waiting_student";
  return "no_offer";
}

/** ลำดับแสดง: รอฉันตอบ → ยังไม่เสนอ → รอนิสิต */
export function negotiateLanePriority(lane: NegotiateLane): number {
  if (lane === "waiting_advisor") return 0;
  if (lane === "no_offer") return 1;
  return 2;
}

/** เรียงคำขอ ACCEPTED ให้งานของอาจารย์ขึ้นก่อน */
export function sortAcceptedNegotiations(
  requests: AdvisorConsultationRequestItem[]
): AdvisorConsultationRequestItem[] {
  return [...requests].sort((left, right) => {
    const laneDiff = negotiateLanePriority(getNegotiateLane(left)) - negotiateLanePriority(getNegotiateLane(right));
    if (laneDiff !== 0) return laneDiff;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

/** เรียงนัดที่ยืนยันแล้วตามวันเวลานัด (ใกล้ถึงก่อน) */
export function sortScheduledByAppointment(
  requests: AdvisorConsultationRequestItem[]
): AdvisorConsultationRequestItem[] {
  return [...requests].sort((left, right) => {
    const leftTime = left.scheduledAt ? new Date(left.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.scheduledAt ? new Date(right.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

/**
 * นัดที่ยืนยันแล้วและอยู่ภายใน horizonMs จาก now (รวมที่เลยไปแล้วเล็กน้อยในวันเดียวกันถ้าต้องการใช้ startOfDay)
 * ค่าเริ่ม: 7 วันข้างหน้า และไม่รวมที่เลยไปแล้วเกิน 1 ชั่วโมง
 */
export function isUpcomingAppointment(
  request: AdvisorConsultationRequestItem,
  now = new Date(),
  horizonMs = 7 * 24 * 60 * 60 * 1000
): boolean {
  if (request.status !== "SCHEDULED" || !request.scheduledAt) return false;
  const at = new Date(request.scheduledAt).getTime();
  if (Number.isNaN(at)) return false;
  const start = now.getTime() - 60 * 60 * 1000;
  const end = now.getTime() + horizonMs;
  return at >= start && at <= end;
}

export function countNegotiateLanes(requests: AdvisorConsultationRequestItem[]) {
  let waitingAdvisor = 0;
  let waitingStudent = 0;
  let noOffer = 0;
  for (const request of requests) {
    if (request.status !== "ACCEPTED") continue;
    const lane = getNegotiateLane(request);
    if (lane === "waiting_advisor") waitingAdvisor += 1;
    else if (lane === "waiting_student") waitingStudent += 1;
    else noOffer += 1;
  }
  return { waitingAdvisor, waitingStudent, noOffer };
}
