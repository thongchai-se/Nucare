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
  request: Pick<
    StudentConsultationRequest,
    "scheduleLocation" | "preferredChannelLabel" | "preferredChannel"
  >
): string {
  const location = request.scheduleLocation?.trim();
  if (location) return location;
  const label = request.preferredChannelLabel?.trim() || "";
  if (request.preferredChannel === "IN_PERSON" || label === "พบตัว / ที่คณะ" || label === "พบที่คณะ") {
    return "ออนไซต์";
  }
  if (request.preferredChannel === "ONLINE") {
    return "ออนไลน์";
  }
  return label;
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

export type StudentMentalHealthAppointmentPreview = {
  id: string;
  scheduledAt: string;
  location: string | null;
  providerName: string;
};

export type UpcomingAppointmentPreviewItem =
  | { kind: "mh"; appointment: StudentMentalHealthAppointmentPreview }
  | { kind: "consult"; request: StudentConsultationRequest };

/**
 * รวมนัดที่ปรึกษา + นัดผู้เชี่ยวชาญ เรียงวันเวลาแล้วตัดตาม limit
 * — หน้าแรกกับหน้าที่ปรึกษาต้องใช้ชุดเดียวกัน
 */
export function buildUpcomingAppointmentPreview(
  consultations: StudentConsultationRequest[],
  mentalHealth: StudentMentalHealthAppointmentPreview[],
  now = new Date(),
  limit = STUDENT_HOME_UPCOMING_LIMIT
): { items: UpcomingAppointmentPreviewItem[]; total: number } {
  const upcomingConsultations = listUpcomingConsultations(consultations, now);
  const upcomingMentalHealth = listUpcomingTimedAppointments(mentalHealth, now);
  const merged = [
    ...upcomingMentalHealth.map((appointment) => ({
      kind: "mh" as const,
      appointment,
      at: new Date(appointment.scheduledAt).getTime(),
    })),
    ...upcomingConsultations.map((request) => ({
      kind: "consult" as const,
      request,
      at: request.scheduledAt ? new Date(request.scheduledAt).getTime() : Number.POSITIVE_INFINITY,
    })),
  ].sort((left, right) => left.at - right.at);

  return {
    total: merged.length,
    items: merged.slice(0, limit).map(({ at: _at, ...item }) => item),
  };
}

/**
 * นับงาน actionable บนแดชบอร์ดนิสิต รวมนัดผู้เชี่ยวชาญใกล้ถึง
 */
export function countStudentDashboardActions(
  requests: StudentConsultationRequest[],
  mentalHealth: TimedAppointment[] = [],
  now = new Date()
): StudentActionCounts {
  const base = countStudentActionQueue(requests, now);
  const mhUpcoming = listUpcomingTimedAppointments(mentalHealth, now).length;
  return {
    ...base,
    upcoming: base.upcoming + mhUpcoming,
  };
}

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

/**
 * แยก peer ที่ทักหาได้ในทีมดูแล กับรายชื่ออื่นที่อยู่นอกทีม — O(n+m) ด้วย Set
 */
export function splitChatPeersByCareTeam<T extends { id: string }>(
  careTeamIds: readonly string[],
  peers: readonly T[]
): { chatableCareTeamIds: Set<string>; otherPeers: T[] } {
  const careSet = new Set(careTeamIds);
  const chatableCareTeamIds = new Set<string>();
  const otherPeers: T[] = [];
  for (const peer of peers) {
    if (careSet.has(peer.id)) {
      chatableCareTeamIds.add(peer.id);
    } else {
      otherPeers.push(peer);
    }
  }
  return { chatableCareTeamIds, otherPeers };
}
