import type { StudentConsultationRequest } from "@/lib/student-dashboard";

const DEFAULT_HORIZON_MS = 7 * 24 * 60 * 60 * 1000;
const PAST_GRACE_MS = 60 * 60 * 1000;

type TimedAppointment = {
  scheduledAt: string | null | undefined;
};

/** นัดที่ยืนยันแล้วและอยู่ภายใน horizon (ค่าเริ่ม 7 วัน) — ไม่รวมที่เลยไปแล้วเกิน 1 ชม. */
export function isUpcomingScheduledAt(
  scheduledAt: string | null | undefined,
  now = new Date(),
  horizonMs = DEFAULT_HORIZON_MS
): boolean {
  if (!scheduledAt) return false;
  const at = new Date(scheduledAt).getTime();
  if (Number.isNaN(at)) return false;
  const start = now.getTime() - PAST_GRACE_MS;
  const end = now.getTime() + horizonMs;
  return at >= start && at <= end;
}

/** คำขอนัดที่ยืนยันแล้วและใกล้ถึง */
export function isUpcomingStudentConsultation(
  request: Pick<StudentConsultationRequest, "status" | "scheduledAt">,
  now = new Date(),
  horizonMs = DEFAULT_HORIZON_MS
): boolean {
  if (request.status !== "SCHEDULED") return false;
  return isUpcomingScheduledAt(request.scheduledAt, now, horizonMs);
}

/** มีข้อเสนอที่รอให้นิสิตยอมรับหรือขอเปลี่ยน */
export function isAwaitingStudentResponse(
  request: Pick<StudentConsultationRequest, "latestPendingOffer">
): boolean {
  return request.latestPendingOffer?.waitingOn === "STUDENT";
}

/** รายการที่นิสิตต้องตอบ — เรียงข้อเสนอใหม่ก่อน O(n log n) */
export function listAwaitingStudentResponses(
  requests: StudentConsultationRequest[]
): StudentConsultationRequest[] {
  return requests
    .filter((request) => isAwaitingStudentResponse(request))
    .sort((left, right) => {
      const leftAt = left.latestPendingOffer?.createdAt ?? left.updatedAt;
      const rightAt = right.latestPendingOffer?.createdAt ?? right.updatedAt;
      return new Date(rightAt).getTime() - new Date(leftAt).getTime();
    });
}

/** นัดปรึกษาใกล้ถึง เรียงวันเวลานัด O(n log n) */
export function listUpcomingConsultations(
  requests: StudentConsultationRequest[],
  now = new Date(),
  horizonMs = DEFAULT_HORIZON_MS
): StudentConsultationRequest[] {
  return requests
    .filter((request) => isUpcomingStudentConsultation(request, now, horizonMs))
    .sort((left, right) => {
      const leftTime = left.scheduledAt ? new Date(left.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
      const rightTime = right.scheduledAt ? new Date(right.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
      return leftTime - rightTime;
    });
}

/** นัดสุขภาพจิตใกล้ถึง เรียงวันเวลา O(n log n) */
export function listUpcomingTimedAppointments<T extends TimedAppointment>(
  appointments: T[],
  now = new Date(),
  horizonMs = DEFAULT_HORIZON_MS
): T[] {
  return appointments
    .filter((item) => isUpcomingScheduledAt(item.scheduledAt, now, horizonMs))
    .sort((left, right) => {
      const leftTime = left.scheduledAt ? new Date(left.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
      const rightTime = right.scheduledAt ? new Date(right.scheduledAt).getTime() : Number.POSITIVE_INFINITY;
      return leftTime - rightTime;
    });
}

export type StudentActionCounts = {
  awaitingStudent: number;
  waitingAdvisor: number;
  upcoming: number;
};

/**
 * นับงานที่สื่อความหมายบน dashboard นิสิต
 * — ต้องตอบ / รออาจารย์ / นัดใกล้ถึง (ไม่นับทุกสถานะที่ไม่ปิด)
 */
export function countStudentActionQueue(
  requests: StudentConsultationRequest[],
  now = new Date()
): StudentActionCounts {
  let awaitingStudent = 0;
  let waitingAdvisor = 0;
  let upcoming = 0;

  for (const request of requests) {
    if (isAwaitingStudentResponse(request)) {
      awaitingStudent += 1;
    } else if (request.status === "PENDING") {
      waitingAdvisor += 1;
    } else if (
      request.status === "ACCEPTED" &&
      (request.latestPendingOffer?.waitingOn === "ADVISOR" || !request.latestPendingOffer)
    ) {
      waitingAdvisor += 1;
    }

    if (isUpcomingStudentConsultation(request, now)) {
      upcoming += 1;
    }
  }

  return { awaitingStudent, waitingAdvisor, upcoming };
}

/** สถานที่นัด — ใช้ scheduleLocation ก่อน แล้วค่อยช่องทางที่สะดวก */
export function resolveAppointmentLocation(
  request: Pick<StudentConsultationRequest, "scheduleLocation" | "preferredChannelLabel">
): string {
  const location = request.scheduleLocation?.trim();
  if (location) return location;
  return request.preferredChannelLabel?.trim() || "";
}

/**
 * ซ่อน marker ชุด demo จากข้อความที่โชว์ให้นิสิต
 * — ไม่แก้ข้อมูลต้นทางใน DB
 */
export function sanitizeStudentFacingNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const cleaned = note
    .split("\n")
    .map((line) => {
      // บรรทัด DEMO-APPT ทั้งบรรทัดซ่อน — ไม่โชว์ข้อความทดสอบนัด
      if (/\[DEMO-APPT\]/i.test(line)) {
        return "";
      }
      return line
        .replace(/^\s*\[(?:WALKTHROUGH|MH-DEMO|DEMO|DEMO-APPT|FULL-SEED|HISTORY-BULK)\]\s*/i, "")
        .replace(/\s*\[(?:WALKTHROUGH|MH-DEMO|DEMO|DEMO-APPT|FULL-SEED|HISTORY-BULK)\]\s*/gi, " ")
        .replace(/\s*\((?:peer|advisor\.peer|mh\.test|student\.test|walkthrough|demo)\)\s*/gi, " ")
        .replace(/\s{2,}/g, " ")
        .trim();
    })
    .filter(Boolean)
    .join("\n")
    .trim();
  return cleaned || null;
}

/** จำนวนรายการที่โชว์ก่อนกด «แสดงเพิ่ม» บนรายการยาว */
export const STUDENT_LIST_PREVIEW_LIMIT = 5;

/** นัดใกล้ถึงบนหน้าหลัก — ไม่ให้เลื่อนยาว */
export const STUDENT_HOME_UPCOMING_LIMIT = 3;

/** มีคำขอเปิดอยู่หรือไม่ (PENDING|ACCEPTED|SCHEDULED|CANCEL_REQUESTED) */
export function hasOpenStudentConsultation(
  requests: Array<{ status: string }>
): boolean {
  return requests.some(
    (request) =>
      request.status === "PENDING" ||
      request.status === "ACCEPTED" ||
      request.status === "SCHEDULED" ||
      request.status === "CANCEL_REQUESTED"
  );
}
