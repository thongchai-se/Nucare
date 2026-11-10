import {
  BehaviorSeverity,
  ConsultationRequestStatus,
  ReferralStatus,
} from "@prisma/client";
import { CANCEL_REQUEST_MARKER, CANCEL_REQUEST_PREFIX } from "./consultation-close";

const SEED_MARKER_LINE =
  /^\s*\[(?:WALKTHROUGH|MH-DEMO|DEMO|DEMO-APPT|FULL-SEED|HISTORY-BULK)\]\s*/i;
const SEED_MARKER_INLINE =
  /\s*\[(?:WALKTHROUGH|MH-DEMO|DEMO|DEMO-APPT|FULL-SEED|HISTORY-BULK)\]\s*/gi;
const TECH_JARGON_INLINE =
  /\s*\((?:peer|advisor\.peer|mh\.test|student\.test|walkthrough|demo)\)\s*/gi;

/** ตัด marker ชุด seed/demo และคำเทคนิคออกจากข้อความที่แสดงผู้ใช้ */
export function stripSeedMarkers(text: string | null | undefined): string {
  if (!text) {
    return "";
  }
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(SEED_MARKER_LINE, "")
        .replace(SEED_MARKER_INLINE, " ")
        .replace(TECH_JARGON_INLINE, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/\s+—\s*$/u, "")
        .replace(/^\s*—\s*/u, "")
        .trim()
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** จัดรูปวันเวลาไทยสำหรับประวัติ */
export function formatHistoryThaiDateTime(value: Date | null | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) {
    return null;
  }
  return value.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

/** ป้ายความเร่งด่วนข้อสังเกต */
export function behaviorSeverityLabel(severity: BehaviorSeverity | string): string {
  if (severity === BehaviorSeverity.HIGH || severity === "HIGH") return "สูง";
  if (severity === BehaviorSeverity.MEDIUM || severity === "MEDIUM") return "ปานกลาง";
  if (severity === BehaviorSeverity.LOW || severity === "LOW") return "ต่ำ";
  return "ไม่ระบุ";
}

/** ป้ายสถานะคำขอปรึกษา */
export function consultationHistoryStatusLabel(status: ConsultationRequestStatus | string): string {
  switch (status) {
    case ConsultationRequestStatus.PENDING:
    case "PENDING":
      return "รอรับคำขอ";
    case ConsultationRequestStatus.ACCEPTED:
    case "ACCEPTED":
      return "รับคำขอแล้ว";
    case ConsultationRequestStatus.SCHEDULED:
    case "SCHEDULED":
      return "นัดหมายแล้ว";
    case ConsultationRequestStatus.CANCEL_REQUESTED:
    case "CANCEL_REQUESTED":
      return "นศขอยกเลิก";
    case ConsultationRequestStatus.CLOSED:
    case "CLOSED":
      return "ปิดเคสแล้ว";
    case ConsultationRequestStatus.CANCELLED:
    case "CANCELLED":
      return "ยกเลิก";
    default:
      return "ไม่ทราบสถานะ";
  }
}

/** ป้ายสถานะส่งต่อ */
export function referralHistoryStatusLabel(status: ReferralStatus | string): string {
  switch (status) {
    case ReferralStatus.PENDING:
    case "PENDING":
      return "รอผู้เชี่ยวชาญรับเคส";
    case ReferralStatus.ACCEPTED:
    case "ACCEPTED":
      return "กำลังดูแล";
    case ReferralStatus.CLOSED:
    case "CLOSED":
      return "ปิดเคสแล้ว";
    default:
      return "ไม่ทราบสถานะ";
  }
}

/** หมายเหตุยกเลิก/ปิด — ตัด prefix ภายในระบบให้อ่านง่าย */
export function presentHistoryAdvisorNote(note: string | null | undefined): string | null {
  const cleaned = stripSeedMarkers(note);
  if (!cleaned) {
    return null;
  }
  if (cleaned.startsWith(CANCEL_REQUEST_PREFIX)) {
    return cleaned.slice(CANCEL_REQUEST_PREFIX.length).trim() || null;
  }
  if (cleaned === CANCEL_REQUEST_MARKER) {
    return "ยกเลิก";
  }
  return cleaned;
}

/** สร้างข้อความ action ของคำขอปรึกษา */
export function formatConsultationHistoryAction(input: {
  channelLabel: string;
  note?: string | null;
  scheduleLocation?: string | null;
}): string {
  const lines = [`ช่องทาง: ${input.channelLabel}`];
  const location = stripSeedMarkers(input.scheduleLocation);
  if (location) {
    lines.push(`สถานที่นัด: ${location}`);
  }
  const note = stripSeedMarkers(input.note);
  if (note) {
    lines.push(note);
  }
  return lines.join("\n");
}

/** สร้างข้อความ outcome ของคำขอปรึกษา */
export function formatConsultationHistoryOutcome(input: {
  status: ConsultationRequestStatus | string;
  scheduledAt?: Date | null;
  advisorNote?: string | null;
}): string {
  const lines = [`สถานะ: ${consultationHistoryStatusLabel(input.status)}`];
  const when = formatHistoryThaiDateTime(input.scheduledAt ?? null);
  if (when) {
    lines.push(`นัดหมาย: ${when}`);
  }
  const note = presentHistoryAdvisorNote(input.advisorNote);
  if (note) {
    lines.push(`หมายเหตุ: ${note}`);
  }
  return lines.join("\n");
}

/** สร้างข้อความ outcome ของข้อสังเกต */
export function formatBehaviorHistoryOutcome(severity: BehaviorSeverity | string): string {
  return `ความเร่งด่วน: ${behaviorSeverityLabel(severity)}`;
}

/** สร้างข้อความ outcome ของการส่งต่อ */
export function formatReferralHistoryOutcome(status: ReferralStatus | string): string {
  return `สถานะ: ${referralHistoryStatusLabel(status)}`;
}
